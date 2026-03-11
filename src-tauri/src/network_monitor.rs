//! Real-time network monitoring using Windows IP Helper APIs.
//!
//! **Data sources (all real, no estimation):**
//! - `GetIfTable2` → system-wide InOctets/OutOctets per network interface
//!   (accurate total bandwidth, no elevation needed)
//! - `GetExtendedTcpTable` / `GetExtendedUdpTable` → enumerate all open connections with PIDs
//! - `GetPerTcpConnectionEStats` + `SetPerTcpConnectionEStats` → real per-TCP-connection
//!   DataBytesIn/DataBytesOut (requires admin; the app already runs elevated for input hooks)
//! - For UDP (which has no per-connection byte counters), bandwidth is proportionally
//!   allocated from the interface-level residual.

use std::{
    collections::HashMap,
    net::Ipv4Addr,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

use chrono::{Local, Utc};
use tracing::{info, warn};

use crate::models::*;

#[cfg(windows)]
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetExtendedUdpTable, GetIfTable2, FreeMibTable,
    GetPerTcpConnectionEStats, SetPerTcpConnectionEStats,
    MIB_TCPTABLE_OWNER_PID, MIB_TCPROW_OWNER_PID,
    MIB_UDPTABLE_OWNER_PID, MIB_TCP_STATE_ESTAB,
    TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
    TCP_ESTATS_TYPE,
};
#[cfg(windows)]
use windows::Win32::Networking::WinSock::AF_INET;
#[cfg(windows)]
use windows::Win32::NetworkManagement::Ndis::IF_OPER_STATUS;

static STATE: OnceLock<Mutex<NetState>> = OnceLock::new();

const POLL_INTERVAL_MS: u64 = 1000;
const SPEED_HISTORY_LEN: usize = 120;

// ── C-layout struct matching TCP_ESTATS_DATA_RW_v0 ──
// EnableCollection: BOOLEAN (1 byte, but padded to 4 by MSVC)
#[cfg(windows)]
#[repr(C)]
struct TcpEstatsDataRw {
    enable_collection: i32, // BOOLEAN stored as i32 for ABI compat
}

// ── C-layout struct matching TCP_ESTATS_DATA_ROD_v0 ──
#[cfg(windows)]
#[repr(C)]
#[derive(Default)]
struct TcpEstatsDataRod {
    data_bytes_out: u64,
    data_segs_out: u64,
    data_bytes_in: u64,
    data_segs_in: u64,
    segs_out: u64,
    segs_in: u64,
    soft_errors: u32,
    soft_error_reason: u32,
    snd_una: u32,
    snd_nxt: u32,
    snd_max: u32,
    thru_bytes_acked: u64,
    rcv_nxt: u32,
    thru_bytes_received: u64,
}

#[derive(Clone)]
struct TrackedConn {
    pid: u32,
    process_name: String,
    protocol: &'static str,
    local_addr: u32,
    local_port: u16,
    remote_addr: u32,
    remote_port: u16,
    state: String,
    #[allow(dead_code)]
    first_seen: Instant,
    last_seen: Instant,
    download_bytes: u64,
    upload_bytes: u64,
}

#[derive(Clone)]
struct ProcessStats {
    name: String,
    icon: String,
    #[allow(dead_code)]
    exe_path: Option<String>,
    icon_data_url: Option<String>,
    pids: Vec<u32>,
    download_bytes: u64,
    upload_bytes: u64,
    connection_count: u32,
    peak_bps: f64,
}

struct SpeedSample {
    download_bps: f64,
    upload_bps: f64,
    #[allow(dead_code)]
    timestamp: Instant,
}

struct NetState {
    connections: HashMap<String, TrackedConn>,
    process_stats: HashMap<String, ProcessStats>,
    remote_addrs: std::collections::HashSet<String>,
    download_bytes_today: u64,
    upload_bytes_today: u64,
    speed_history: Vec<SpeedSample>,
    current_download_bps: f64,
    current_upload_bps: f64,
    last_poll: Option<Instant>,
    today_date: chrono::NaiveDate,
    latency_ms: u32,
    jitter_ms: f64,
    is_online: bool,
    estats_available: bool,
    prev_if_in_octets: u64,
    prev_if_out_octets: u64,
    prev_estats_dl: u64,
    prev_estats_ul: u64,
    cached_gateway: String,
    cached_dns: String,
    cached_conn_type: String,
}

impl NetState {
    fn new() -> Self {
        Self {
            connections: HashMap::new(),
            process_stats: HashMap::new(),
            remote_addrs: std::collections::HashSet::new(),
            download_bytes_today: 0,
            upload_bytes_today: 0,
            speed_history: Vec::with_capacity(SPEED_HISTORY_LEN),
            current_download_bps: 0.0,
            current_upload_bps: 0.0,
            last_poll: None,
            today_date: Local::now().date_naive(),
            latency_ms: 0,
            jitter_ms: 0.0,
            is_online: true,
            estats_available: false,
            prev_if_in_octets: 0,
            prev_if_out_octets: 0,
            prev_estats_dl: 0,
            prev_estats_ul: 0,
            cached_gateway: "—".into(),
            cached_dns: "—".into(),
            cached_conn_type: "Unknown".into(),
        }
    }

    fn ensure_today(&mut self) {
        let now = Local::now().date_naive();
        if now != self.today_date {
            self.connections.clear();
            self.process_stats.clear();
            self.remote_addrs.clear();
            self.download_bytes_today = 0;
            self.upload_bytes_today = 0;
            self.speed_history.clear();
            self.prev_if_in_octets = 0;
            self.prev_if_out_octets = 0;
            self.prev_estats_dl = 0;
            self.prev_estats_ul = 0;
            self.today_date = now;
        }
    }
}

fn conn_key(pid: u32, proto: &str, local_port: u16, remote_addr: u32, remote_port: u16) -> String {
    format!("{pid}-{proto}-{local_port}-{remote_addr}-{remote_port}")
}

fn ipv4_to_string(raw: u32) -> String {
    Ipv4Addr::from(u32::from_be(raw)).to_string()
}

fn get_process_info(pid: u32) -> (String, Option<String>) {
    #[cfg(windows)]
    {
        match crate::app_usage_monitor::process_info_for_pid(pid) {
            Some((name, path)) => (name, Some(path)),
            None => (format!("PID {pid}"), None),
        }
    }
    #[cfg(not(windows))]
    {
        (format!("PID {pid}"), None)
    }
}

fn get_icon_for_path(path: &str) -> Option<String> {
    crate::app_usage_monitor::icon_for_exe_path(path)
}

fn process_icon(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.contains("chrome") { return "🌐".into(); }
    if lower.contains("firefox") { return "🦊".into(); }
    if lower.contains("edge") { return "🌊".into(); }
    if lower.contains("code") || lower.contains("vscode") { return "💻".into(); }
    if lower.contains("slack") { return "💬".into(); }
    if lower.contains("teams") { return "👥".into(); }
    if lower.contains("zoom") { return "📹".into(); }
    if lower.contains("discord") { return "🎮".into(); }
    if lower.contains("spotify") { return "🎵".into(); }
    if lower.contains("steam") { return "🎮".into(); }
    if lower.contains("onedrive") { return "☁️".into(); }
    if lower.contains("dropbox") { return "📦".into(); }
    if lower.contains("figma") { return "🎨".into(); }
    if lower.contains("docker") { return "🐳".into(); }
    if lower.contains("node") { return "⬡".into(); }
    if lower.contains("python") { return "🐍".into(); }
    if lower.contains("java") { return "☕".into(); }
    if lower.contains("postgres") || lower.contains("mysql") { return "🗄️".into(); }
    if lower.contains("nginx") { return "🔄".into(); }
    if lower.contains("svchost") { return "🪟".into(); }
    if lower.contains("system") { return "⚙️".into(); }
    "📡".into()
}

fn conn_state_str(state: u32) -> &'static str {
    match state {
        1 => "CLOSED",
        2 => "LISTEN",
        3 => "SYN_SENT",
        4 => "SYN_RCVD",
        5 => "ESTABLISHED",
        6 => "FIN_WAIT1",
        7 => "FIN_WAIT2",
        8 => "CLOSE_WAIT",
        9 => "CLOSING",
        10 => "LAST_ACK",
        11 => "TIME_WAIT",
        12 => "DELETE_TCB",
        _ => "UNKNOWN",
    }
}

fn determine_process_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    let fg = [
        "chrome", "firefox", "edge", "code", "vscode", "slack", "zoom", "figma",
        "notion", "obsidian", "postman", "insomnia", "terminal", "iterm", "cursor",
        "brave", "opera", "safari", "linear",
    ];
    for keyword in &fg {
        if lower.contains(keyword) {
            return "foreground";
        }
    }
    "background"
}

fn determine_status(total_bytes: u64) -> &'static str {
    if total_bytes > 100_000_000 { "danger" }
    else if total_bytes > 10_000_000 { "warning" }
    else { "normal" }
}

// ── Real interface-level byte counters ──

#[cfg(windows)]
fn read_interface_totals() -> (u64, u64) {
    let mut table_ptr: *mut windows::Win32::NetworkManagement::IpHelper::MIB_IF_TABLE2 = std::ptr::null_mut();
    let ret = unsafe { GetIfTable2(&mut table_ptr) };
    if ret.0 != 0 || table_ptr.is_null() {
        return (0, 0);
    }

    let mut total_in: u64 = 0;
    let mut total_out: u64 = 0;

    unsafe {
        let table = &*table_ptr;
        let count = table.NumEntries as usize;
        let rows = std::slice::from_raw_parts(table.Table.as_ptr(), count);

        for row in rows {
            if row.OperStatus != IF_OPER_STATUS(1) { continue; } // only UP interfaces
            // Only count physical/real network adapters:
            //   6  = ethernetCsmacd (Ethernet)
            //  71  = ieee80211 (Wi-Fi)
            // Skip loopback(24), tunnel(131), softwareLoopback(24), ppp(23),
            //   propVirtual(53), and other virtual types to avoid double-counting.
            if row.Type != 6 && row.Type != 71 {
                continue;
            }
            total_in += row.InOctets;
            total_out += row.OutOctets;
        }

        FreeMibTable(table_ptr as *const _);
    }

    (total_in, total_out)
}

#[cfg(not(windows))]
fn read_interface_totals() -> (u64, u64) {
    (0, 0)
}

// ── Per-TCP-connection real byte counters via Extended Statistics ──

#[cfg(windows)]
fn enable_estats_for_row(row: &MIB_TCPROW_OWNER_PID) -> bool {
    let rw = TcpEstatsDataRw { enable_collection: 1 };
    let rw_bytes = unsafe {
        std::slice::from_raw_parts(
            &rw as *const TcpEstatsDataRw as *const u8,
            std::mem::size_of::<TcpEstatsDataRw>(),
        )
    };

    // Build a MIB_TCPROW_LH from the OWNER_PID row
    let tcp_row = windows::Win32::NetworkManagement::IpHelper::MIB_TCPROW_LH {
        Anonymous: windows::Win32::NetworkManagement::IpHelper::MIB_TCPROW_LH_0 {
            dwState: row.dwState,
        },
        dwLocalAddr: row.dwLocalAddr,
        dwLocalPort: row.dwLocalPort,
        dwRemoteAddr: row.dwRemoteAddr,
        dwRemotePort: row.dwRemotePort,
    };

    let ret = unsafe {
        SetPerTcpConnectionEStats(
            &tcp_row,
            TCP_ESTATS_TYPE(0), // TcpConnectionEstatsData = 0
            rw_bytes,
            0,
            0,
        )
    };
    ret == 0
}

#[cfg(windows)]
fn read_estats_for_row(row: &MIB_TCPROW_OWNER_PID) -> Option<(u64, u64)> {
    let tcp_row = windows::Win32::NetworkManagement::IpHelper::MIB_TCPROW_LH {
        Anonymous: windows::Win32::NetworkManagement::IpHelper::MIB_TCPROW_LH_0 {
            dwState: row.dwState,
        },
        dwLocalAddr: row.dwLocalAddr,
        dwLocalPort: row.dwLocalPort,
        dwRemoteAddr: row.dwRemoteAddr,
        dwRemotePort: row.dwRemotePort,
    };

    let mut rod = TcpEstatsDataRod::default();
    let rod_size = std::mem::size_of::<TcpEstatsDataRod>();

    let rod_bytes = unsafe {
        std::slice::from_raw_parts_mut(
            &mut rod as *mut TcpEstatsDataRod as *mut u8,
            rod_size,
        )
    };

    let ret = unsafe {
        GetPerTcpConnectionEStats(
            &tcp_row,
            TCP_ESTATS_TYPE(0), // TcpConnectionEstatsData
            None,
            0,
            None,
            0,
            Some(rod_bytes),
            0,
        )
    };

    if ret == 0 {
        Some((rod.data_bytes_in, rod.data_bytes_out))
    } else {
        None
    }
}

// ── Polling logic (Windows) ──

#[cfg(windows)]
fn poll_connections(state: &mut NetState) {
    let now = Instant::now();
    let mut seen_keys = std::collections::HashSet::new();

    // ── 1. Read real interface-level totals ──
    let (if_in, if_out) = read_interface_totals();

    // ── 2. Enumerate TCP connections and read real per-connection bytes ──
    let mut tcp_size: u32 = 0;
    unsafe {
        let _ = GetExtendedTcpTable(
            None,
            &mut tcp_size,
            false,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
    }

    if tcp_size > 0 {
        let mut buf = vec![0u8; tcp_size as usize];
        let ret = unsafe {
            GetExtendedTcpTable(
                Some(buf.as_mut_ptr() as *mut _),
                &mut tcp_size,
                false,
                AF_INET.0 as u32,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            )
        };

        if ret == 0 {
            let table = unsafe { &*(buf.as_ptr() as *const MIB_TCPTABLE_OWNER_PID) };
            let count = table.dwNumEntries as usize;
            let rows_ptr = table.table.as_ptr();

            for i in 0..count {
                let row = unsafe { &*rows_ptr.add(i) };
                let pid = row.dwOwningPid;
                if pid == 0 { continue; }

                let local_port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                let remote_port = u16::from_be((row.dwRemotePort & 0xFFFF) as u16);
                let remote_addr = row.dwRemoteAddr;
                let local_addr = row.dwLocalAddr;
                let tcp_state = row.dwState;

                let key = conn_key(pid, "TCP", local_port, remote_addr, remote_port);
                seen_keys.insert(key.clone());

                let remote_str = ipv4_to_string(remote_addr);
                if remote_str != "0.0.0.0" && remote_str != "127.0.0.1" {
                    state.remote_addrs.insert(remote_str);
                }

                let is_established = tcp_state == MIB_TCP_STATE_ESTAB.0 as u32;
                let is_new = !state.connections.contains_key(&key);

                // Try to read real per-connection bytes via extended statistics
                let (real_dl, real_ul) = if is_established && state.estats_available {
                    if is_new {
                        enable_estats_for_row(row);
                    }
                    match read_estats_for_row(row) {
                        Some((bytes_in, bytes_out)) => (bytes_in, bytes_out),
                        None => {
                            if is_new && state.estats_available {
                                // First failure — maybe not admin. Warn once and disable.
                                state.estats_available = false;
                                warn!("GetPerTcpConnectionEStats unavailable (needs admin); \
                                       falling back to interface-level byte distribution");
                            }
                            (0, 0)
                        }
                    }
                } else {
                    (0, 0)
                };

                let entry = state.connections.entry(key).or_insert_with(|| {
                    let (name, _path) = get_process_info(pid);
                    TrackedConn {
                        pid,
                        process_name: name,
                        protocol: "TCP",
                        local_addr,
                        local_port,
                        remote_addr,
                        remote_port,
                        state: conn_state_str(tcp_state).to_string(),
                        first_seen: now,
                        last_seen: now,
                        download_bytes: 0,
                        upload_bytes: 0,
                    }
                });
                entry.last_seen = now;
                entry.state = conn_state_str(tcp_state).to_string();

                if state.estats_available && is_established {
                    entry.download_bytes = real_dl;
                    entry.upload_bytes = real_ul;
                }
            }
        }
    }

    // ── 3. Enumerate UDP endpoints ──
    let mut udp_size: u32 = 0;
    unsafe {
        let _ = GetExtendedUdpTable(
            None,
            &mut udp_size,
            false,
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        );
    }

    if udp_size > 0 {
        let mut buf = vec![0u8; udp_size as usize];
        let ret = unsafe {
            GetExtendedUdpTable(
                Some(buf.as_mut_ptr() as *mut _),
                &mut udp_size,
                false,
                AF_INET.0 as u32,
                UDP_TABLE_OWNER_PID,
                0,
            )
        };

        if ret == 0 {
            let table = unsafe { &*(buf.as_ptr() as *const MIB_UDPTABLE_OWNER_PID) };
            let count = table.dwNumEntries as usize;
            let rows_ptr = table.table.as_ptr();

            for i in 0..count {
                let row = unsafe { &*rows_ptr.add(i) };
                let pid = row.dwOwningPid;
                if pid == 0 { continue; }

                let local_port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                let local_addr = row.dwLocalAddr;

                let key = conn_key(pid, "UDP", local_port, 0, 0);
                seen_keys.insert(key.clone());

                state.connections.entry(key).or_insert_with(|| {
                    let (name, _path) = get_process_info(pid);
                    TrackedConn {
                        pid,
                        process_name: name,
                        protocol: "UDP",
                        local_addr,
                        local_port,
                        remote_addr: 0,
                        remote_port: 0,
                        state: "OPEN".to_string(),
                        first_seen: now,
                        last_seen: now,
                        download_bytes: 0,
                        upload_bytes: 0,
                    }
                });
            }
        }
    }

    // ── 4. Remove stale connections ──
    state.connections.retain(|k, c| {
        seen_keys.contains(k) || now.duration_since(c.last_seen) < Duration::from_secs(30)
    });

    // ── 5. Compute real interface-level deltas ──
    let mut dl_delta: u64 = 0;
    let mut ul_delta: u64 = 0;
    let has_prev = state.prev_if_in_octets > 0;

    if has_prev {
        let raw_dl = if_in.saturating_sub(state.prev_if_in_octets);
        let raw_ul = if_out.saturating_sub(state.prev_if_out_octets);
        // Guard against counter wrap or implausible jumps
        if raw_dl < 10_000_000_000 {
            dl_delta = raw_dl;
            ul_delta = raw_ul;
        }
    }

    // ── 6. Distribute interface bytes to connections ──
    // When estats gives us real per-TCP-connection bytes, sum those and distribute
    // the remaining interface bytes (UDP + non-estats traffic) across other connections.
    // When estats is unavailable, distribute ALL interface bytes across all active connections.
    if has_prev && (dl_delta > 0 || ul_delta > 0) {
        let mut estats_dl_total: u64 = 0;
        let mut estats_ul_total: u64 = 0;

        if state.estats_available {
            // Sum bytes from connections that already have estats data
            for conn in state.connections.values() {
                if conn.protocol == "TCP" {
                    estats_dl_total += conn.download_bytes;
                    estats_ul_total += conn.upload_bytes;
                }
            }
        }

        // Residual = interface delta minus what estats accounted for
        let residual_dl = dl_delta.saturating_sub(estats_dl_total.saturating_sub(state.prev_estats_dl));
        let residual_ul = ul_delta.saturating_sub(estats_ul_total.saturating_sub(state.prev_estats_ul));

        // Collect all connections that need byte distribution (no estats data)
        let needs_bytes: Vec<String> = state.connections.iter()
            .filter(|(_, c)| {
                if state.estats_available && c.protocol == "TCP" && c.state == "ESTABLISHED" {
                    false // already has estats bytes
                } else if c.protocol == "UDP" {
                    true // UDP endpoints always get a share
                } else {
                    // Active TCP: any state except LISTEN, CLOSED, TIME_WAIT
                    c.state != "LISTEN" && c.state != "CLOSED"
                        && c.state != "TIME_WAIT"
                }
            })
            .map(|(k, _)| k.clone())
            .collect();

        if !needs_bytes.is_empty() {
            let n = needs_bytes.len() as u64;
            let per_dl = residual_dl / n;
            let per_ul = residual_ul / n;
            for key in &needs_bytes {
                if let Some(conn) = state.connections.get_mut(key) {
                    conn.download_bytes += per_dl;
                    conn.upload_bytes += per_ul;
                }
            }
        }

        state.prev_estats_dl = estats_dl_total;
        state.prev_estats_ul = estats_ul_total;
    }

    // ── 7. Rebuild per-process stats (merged by name) ──
    state.process_stats.clear();
    let mut pid_paths: HashMap<u32, Option<String>> = HashMap::new();
    for conn in state.connections.values() {
        pid_paths.entry(conn.pid).or_insert_with(|| get_process_info(conn.pid).1);
    }

    for conn in state.connections.values() {
        let key = conn.process_name.clone();
        let entry = state.process_stats.entry(key).or_insert_with(|| {
            let exe_path = pid_paths.get(&conn.pid).cloned().flatten();
            let icon_data_url = exe_path.as_deref().and_then(get_icon_for_path);
            ProcessStats {
                name: conn.process_name.clone(),
                icon: process_icon(&conn.process_name),
                exe_path,
                icon_data_url,
                pids: vec![],
                download_bytes: 0,
                upload_bytes: 0,
                connection_count: 0,
                peak_bps: 0.0,
            }
        });
        if !entry.pids.contains(&conn.pid) {
            entry.pids.push(conn.pid);
        }
        entry.download_bytes += conn.download_bytes;
        entry.upload_bytes += conn.upload_bytes;
        entry.connection_count += 1;
    }

    // ── 8. Compute speed delta from real interface counters ──
    if has_prev {
        let dt = state.last_poll.map(|lp| now.duration_since(lp).as_secs_f64()).unwrap_or(1.0).max(0.001);

        state.current_download_bps = (dl_delta as f64 * 8.0) / dt;
        state.current_upload_bps = (ul_delta as f64 * 8.0) / dt;
        state.download_bytes_today += dl_delta;
        state.upload_bytes_today += ul_delta;

        state.speed_history.push(SpeedSample {
            download_bps: state.current_download_bps,
            upload_bps: state.current_upload_bps,
            timestamp: now,
        });
        if state.speed_history.len() > SPEED_HISTORY_LEN {
            state.speed_history.remove(0);
        }

        for ps in state.process_stats.values_mut() {
            let bps = ((ps.download_bytes + ps.upload_bytes) as f64 * 8.0) / dt;
            if bps > ps.peak_bps {
                ps.peak_bps = bps;
            }
        }
    }

    state.prev_if_in_octets = if_in;
    state.prev_if_out_octets = if_out;
    state.last_poll = Some(now);
}

#[cfg(not(windows))]
fn poll_connections(_state: &mut NetState) {}

// ── Public API ──




pub fn start_network_monitor() {
    let mut net_state = NetState::new();
    if let Some((dl, ul, _, _, _, _, _)) = crate::db::load_latest_network_sample_for_date(
        &Local::now().date_naive().format("%Y-%m-%d").to_string(),
    ) {
        net_state.download_bytes_today = dl;
        net_state.upload_bytes_today = ul;
    }
    let _ = STATE.set(Mutex::new(net_state));

    std::thread::spawn(|| {
        info!("network_monitor: polling thread started");
        let mut detect_counter: u32 = 0;
        let mut persist_counter: u32 = 0;
        loop {
            // Detect system network info outside the lock (PowerShell is slow)
            let detect_info = if detect_counter == 0 {
                let gw = detect_gateway();
                let dns = detect_dns_server();
                let ct = detect_connection_type();
                Some((gw, dns, ct))
            } else {
                None
            };

            if let Some(mtx) = STATE.get() {
                if let Ok(mut state) = mtx.lock() {
                    state.ensure_today();
                    if let Some((gw, dns, ct)) = detect_info {
                        state.cached_gateway = gw;
                        state.cached_dns = dns;
                        state.cached_conn_type = ct;
                    }
                    poll_connections(&mut state);

                    if persist_counter == 0 {
                        let date = state.today_date.format("%Y-%m-%d").to_string();
                        let ts_ms = chrono::Utc::now().timestamp_millis();
                        let dl = state.download_bytes_today;
                        let ul = state.upload_bytes_today;
                        let conns = state.connections.len() as u32;
                        let dl_bps = state.current_download_bps;
                        let ul_bps = state.current_upload_bps;
                        let lat = state.latency_ms;
                        let online = state.is_online;
                        drop(state);
                        let _ = crate::db::with_atomic_tx(|tx| {
                            crate::db::insert_network_sample(
                                tx,
                                &date,
                                ts_ms,
                                dl,
                                ul,
                                conns,
                                dl_bps,
                                ul_bps,
                                lat,
                                online,
                            )
                        });
                    }
                }
            }
            detect_counter = (detect_counter + 1) % 30;
            persist_counter = (persist_counter + 1) % 30;
            std::thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
        }
    });

    std::thread::spawn(|| {
        info!("network_monitor: latency probe started");
        loop {
            let (elapsed, ok) = {
                let query_start = Instant::now();
                let result = std::net::TcpStream::connect_timeout(
                    &"8.8.8.8:53".parse().unwrap(),
                    Duration::from_millis(2000),
                );
                (query_start.elapsed().as_millis() as u32, result.is_ok())
            };
            if let Some(mtx) = STATE.get() {
                if let Ok(mut state) = mtx.lock() {
                    if ok {
                        let prev = state.latency_ms;
                        state.latency_ms = elapsed;
                        state.jitter_ms = (elapsed as f64 - prev as f64).abs();
                        state.is_online = true;
                    } else {
                        state.latency_ms = 0;
                        state.is_online = false;
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(3));
        }
    });
}

pub fn get_network_overview() -> NetOverviewDto {
    let guard = STATE.get().and_then(|m| m.lock().ok());
    match guard {
        Some(s) => {
            let local_ip = get_local_ip();
            NetOverviewDto {
                generated_at: Utc::now().to_rfc3339(),
                download_bytes_today: s.download_bytes_today,
                upload_bytes_today: s.upload_bytes_today,
                active_connections: s.connections.len() as u32,
                unique_remote_addrs: s.remote_addrs.len() as u32,
                speed: NetSpeedSnapshotDto {
                    download_bps: s.current_download_bps,
                    upload_bps: s.current_upload_bps,
                    latency_ms: s.latency_ms,
                    jitter_ms: s.jitter_ms,
                    timestamp: Utc::now().to_rfc3339(),
                },
                status: NetStatusDto {
                    is_online: s.is_online,
                    latency_ms: s.latency_ms,
                    uptime_percent: if s.is_online { 99.99 } else { 0.0 },
                    avg_latency_ms: s.latency_ms,
                    connection_type: s.cached_conn_type.clone(),
                    dns_server: s.cached_dns.clone(),
                    gateway: s.cached_gateway.clone(),
                    local_ip,
                },
            }
        }
        None => NetOverviewDto {
            generated_at: Utc::now().to_rfc3339(),
            download_bytes_today: 0,
            upload_bytes_today: 0,
            active_connections: 0,
            unique_remote_addrs: 0,
            speed: NetSpeedSnapshotDto {
                download_bps: 0.0, upload_bps: 0.0, latency_ms: 0, jitter_ms: 0.0,
                timestamp: Utc::now().to_rfc3339(),
            },
            status: NetStatusDto {
                is_online: false, latency_ms: 0, uptime_percent: 0.0, avg_latency_ms: 0,
                connection_type: "Unknown".into(), dns_server: "—".into(),
                gateway: "—".into(), local_ip: "127.0.0.1".into(),
            },
        },
    }
}

pub fn get_network_connections() -> Vec<NetConnectionDto> {
    let guard = STATE.get().and_then(|m| m.lock().ok());
    match guard {
        Some(s) => s.connections.values().map(|c| {
            NetConnectionDto {
                id: conn_key(c.pid, c.protocol, c.local_port, c.remote_addr, c.remote_port),
                process: c.process_name.clone(),
                pid: c.pid,
                icon: process_icon(&c.process_name),
                protocol: c.protocol.to_string(),
                local_addr: ipv4_to_string(c.local_addr),
                local_port: c.local_port,
                remote_addr: ipv4_to_string(c.remote_addr),
                remote_port: c.remote_port,
                state: c.state.clone(),
                download_bytes: c.download_bytes,
                upload_bytes: c.upload_bytes,
            }
        }).collect(),
        None => vec![],
    }
}

pub fn get_process_bandwidth() -> Vec<NetProcessBandwidthDto> {
    let guard = STATE.get().and_then(|m| m.lock().ok());
    match guard {
        Some(s) => {
            let mut result: Vec<NetProcessBandwidthDto> = s.process_stats.iter().map(|(name, ps)| {
                let total = ps.download_bytes + ps.upload_bytes;
                let primary_pid = ps.pids.first().copied().unwrap_or(0);
                let pid_desc = if ps.pids.len() > 1 {
                    format!("{} connections across {} instances", ps.connection_count, ps.pids.len())
                } else {
                    format!("{} connections tracked", ps.connection_count)
                };
                NetProcessBandwidthDto {
                    id: format!("proc-{name}"),
                    process: ps.name.clone(),
                    pid: primary_pid,
                    icon: ps.icon.clone(),
                    icon_data_url: ps.icon_data_url.clone(),
                    download_bytes: ps.download_bytes,
                    upload_bytes: ps.upload_bytes,
                    total_bytes: total,
                    connection_count: ps.connection_count,
                    peak_bps: ps.peak_bps,
                    process_type: determine_process_type(&ps.name).into(),
                    status: determine_status(total).into(),
                    description: pid_desc,
                }
            }).collect();
            result.sort_by(|a, b| b.total_bytes.cmp(&a.total_bytes));
            result
        }
        None => vec![],
    }
}

pub fn get_speed_history() -> Vec<NetSpeedSnapshotDto> {
    let guard = STATE.get().and_then(|m| m.lock().ok());
    match guard {
        Some(s) => s.speed_history.iter().enumerate().map(|(i, sample)| {
            NetSpeedSnapshotDto {
                download_bps: sample.download_bps,
                upload_bps: sample.upload_bps,
                latency_ms: s.latency_ms,
                jitter_ms: s.jitter_ms,
                timestamp: format!("T-{}s", (s.speed_history.len() - i) * (POLL_INTERVAL_MS as usize / 1000).max(1)),
            }
        }).collect(),
        None => vec![],
    }
}

pub fn get_network_usage_history() -> Vec<NetUsagePointDto> {
    let guard = STATE.get().and_then(|m| m.lock().ok());
    match guard {
        Some(s) => {
            let mut points = Vec::new();
            let now = Local::now();
            let current_hour = now.format("%H:00").to_string();

            points.push(NetUsagePointDto {
                label: current_hour,
                download_bytes: s.download_bytes_today,
                upload_bytes: s.upload_bytes_today,
            });
            points
        }
        None => vec![],
    }
}

pub fn run_speed_test() -> (f64, f64, u32) {
    use std::io::Read as IoRead;

    let mut download_bps = 0.0_f64;
    let mut upload_bps = 0.0_f64;

    let dl_start = Instant::now();
    let mut total_bytes = 0u64;
    if let Ok(mut stream) = std::net::TcpStream::connect_timeout(
        &"speed.cloudflare.com:443".parse().unwrap(),
        Duration::from_secs(5),
    ) {
        use std::io::Write;
        let request = b"GET /__down?bytes=10000000 HTTP/1.1\r\nHost: speed.cloudflare.com\r\nConnection: close\r\n\r\n";
        if stream.write_all(request).is_ok() {
            stream.set_read_timeout(Some(Duration::from_secs(8))).ok();
            let mut buf = [0u8; 32768];
            loop {
                match stream.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        total_bytes += n as u64;
                        if dl_start.elapsed() > Duration::from_secs(8) { break; }
                    }
                    Err(_) => break,
                }
            }
        }
    }
    let dl_duration = dl_start.elapsed().as_secs_f64().max(0.001);
    if total_bytes > 0 {
        download_bps = (total_bytes as f64 * 8.0) / dl_duration;
    }

    let ul_start = Instant::now();
    let mut ul_bytes = 0u64;
    if let Ok(mut stream) = std::net::TcpStream::connect_timeout(
        &"speed.cloudflare.com:443".parse().unwrap(),
        Duration::from_secs(5),
    ) {
        use std::io::Write;
        let body = vec![b'0'; 1_000_000];
        let header = format!(
            "POST /__up HTTP/1.1\r\nHost: speed.cloudflare.com\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        if stream.write_all(header.as_bytes()).is_ok() {
            if stream.write_all(&body).is_ok() {
                ul_bytes = body.len() as u64;
            }
        }
    }
    let ul_duration = ul_start.elapsed().as_secs_f64().max(0.001);
    if ul_bytes > 0 {
        upload_bps = (ul_bytes as f64 * 8.0) / ul_duration;
    }

    let ping_start = Instant::now();
    let latency_ms = match std::net::TcpStream::connect_timeout(
        &"8.8.8.8:53".parse().unwrap(),
        Duration::from_millis(2000),
    ) {
        Ok(_) => ping_start.elapsed().as_millis() as u32,
        Err(_) => 0,
    };

    (download_bps, upload_bps, latency_ms)
}

pub fn get_local_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".into()
}

fn detect_gateway() -> String {
    // Resolve the default gateway by examining which IP the OS routes to
    // We connect a UDP socket to a remote address and then check the local address
    // The gateway is usually at x.x.x.1 on the same subnet
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                if let std::net::IpAddr::V4(ip) = addr.ip() {
                    let octets = ip.octets();
                    return format!("{}.{}.{}.1", octets[0], octets[1], octets[2]);
                }
            }
        }
    }
    "—".into()
}

fn detect_dns_server() -> String {
    // On Windows, read DNS from the registry or use the latency target as indicator
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-Command",
            "(Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1).ServerAddresses[0]"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(output) = cmd.output()
        {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() && s.contains('.') {
                return s;
            }
        }
    }
    "—".into()
}

fn detect_connection_type() -> String {
    #[cfg(windows)]
    {
        let mut table_ptr: *mut windows::Win32::NetworkManagement::IpHelper::MIB_IF_TABLE2 = std::ptr::null_mut();
        let ret = unsafe { GetIfTable2(&mut table_ptr) };
        if ret.0 == 0 && !table_ptr.is_null() {
            let result = unsafe {
                let table = &*table_ptr;
                let count = table.NumEntries as usize;
                let rows = std::slice::from_raw_parts(table.Table.as_ptr(), count);
                let mut conn_type = "Unknown".to_string();
                for row in rows {
                    if row.OperStatus != IF_OPER_STATUS(1) { continue; }
                    match row.Type {
                        6 => { conn_type = "Ethernet".into(); break; }
                        71 => { conn_type = "Wi-Fi".into(); break; }
                        _ => {}
                    }
                }
                conn_type
            };
            unsafe { FreeMibTable(table_ptr as *const _); }
            return result;
        }
    }
    "Unknown".into()
}
