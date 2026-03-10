use chrono::Utc;
use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicI32, AtomicU64},
        mpsc::{self, Sender},
        OnceLock,
    },
    thread,
};
use tauri::{AppHandle, Emitter, Runtime};
use tracing::{error, info, warn};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputMonitorEventDto {
    pub kind: &'static str,
    pub action: &'static str,
    pub label: String,
    pub state_key: Option<String>,
    pub button: Option<&'static str>,
    pub direction: Option<&'static str>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub timestamp: i64,
}

const INPUT_MONITOR_EVENT: &str = "input-monitor://event";

static EVENT_SENDER: OnceLock<Sender<InputMonitorEventDto>> = OnceLock::new();
static LAST_MOVE_TICK: AtomicU64 = AtomicU64::new(0);
static LAST_MOVE_X: AtomicI32 = AtomicI32::new(i32::MIN);
static LAST_MOVE_Y: AtomicI32 = AtomicI32::new(i32::MIN);

#[cfg(not(windows))]
pub fn start_global_input_monitor<R: Runtime>(_app: AppHandle<R>) {
    warn!("global input monitor is only implemented on Windows");
}

#[cfg(windows)]
pub fn start_global_input_monitor<R: Runtime>(app: AppHandle<R>) {
    let (tx, rx) = mpsc::channel::<InputMonitorEventDto>();

    if EVENT_SENDER.set(tx).is_err() {
        warn!("global input monitor already initialized");
        return;
    }

    crate::input_aggregator::init();

    let emitter_app = app.clone();
    thread::spawn(move || {
        for event in rx {
            crate::input_aggregator::record(&event);
            if let Err(error) = emitter_app.emit(INPUT_MONITOR_EVENT, event) {
                error!(?error, "failed to emit input monitor event");
            }
        }
    });

    thread::spawn(move || {
        #[cfg(windows)]
        unsafe {
            if let Err(error) = windows_impl::run_global_hook_loop() {
                error!(?error, "global input monitor stopped unexpectedly");
            }
        }
    });

    info!("started global input monitor");
}

#[cfg(windows)]
fn emit_event(event: InputMonitorEventDto) {
    if let Some(sender) = EVENT_SENDER.get() {
        if let Err(error) = sender.send(event) {
            error!(?error, "failed to queue input monitor event");
        }
    }
}

#[cfg(windows)]
fn make_event(
    kind: &'static str,
    action: &'static str,
    label: String,
    state_key: Option<String>,
    button: Option<&'static str>,
    direction: Option<&'static str>,
    x: Option<i32>,
    y: Option<i32>,
) -> InputMonitorEventDto {
    InputMonitorEventDto {
        kind,
        action,
        label,
        state_key,
        button,
        direction,
        x,
        y,
        timestamp: Utc::now().timestamp_millis(),
    }
}

#[cfg(windows)]
mod windows_impl {
    use super::{emit_event, make_event, LAST_MOVE_TICK, LAST_MOVE_X, LAST_MOVE_Y};
    use std::fmt;
    use std::sync::atomic::Ordering;
    use windows::Win32::{
        Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM},
        System::{LibraryLoader::GetModuleHandleW, SystemInformation::GetTickCount64},
        UI::WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
            UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL,
            WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN,
            WM_MBUTTONUP, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SYSKEYDOWN,
            WM_SYSKEYUP,
        },
    };

    pub unsafe fn run_global_hook_loop() -> Result<(), HookInstallError> {
        let module = GetModuleHandleW(None).map_err(HookInstallError::ModuleHandle)?;
        let keyboard_hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_proc),
            Some(HINSTANCE(module.0)),
            0,
        )
        .map_err(HookInstallError::KeyboardHook)?;
        let mouse_hook =
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), Some(HINSTANCE(module.0)), 0)
                .map_err(HookInstallError::MouseHook)?;

        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).into() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }

        let _ = UnhookWindowsHookEx(keyboard_hook);
        let _ = UnhookWindowsHookEx(mouse_hook);

        Ok(())
    }

    unsafe extern "system" fn keyboard_proc(
        code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if code == HC_ACTION as i32 {
            let keyboard = *(l_param.0 as *const KBDLLHOOKSTRUCT);
            let message = w_param.0 as u32;

            let action = match message {
                WM_KEYDOWN | WM_SYSKEYDOWN => Some("press"),
                WM_KEYUP | WM_SYSKEYUP => Some("release"),
                _ => None,
            };

            if let Some(action) = action {
                if let Some((state_key, key_name)) = map_keyboard_key(&keyboard) {
                    emit_event(make_event(
                        "keyboard",
                        action,
                        format!("{} {}", capitalize(action), key_name),
                        Some(state_key.to_string()),
                        None,
                        None,
                        None,
                        None,
                    ));
                }
            }
        }

        CallNextHookEx(None, code, w_param, l_param)
    }

    unsafe extern "system" fn mouse_proc(code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let mouse = *(l_param.0 as *const MSLLHOOKSTRUCT);
            let message = w_param.0 as u32;

            match message {
                WM_LBUTTONDOWN => emit_event(make_event(
                    "mouse",
                    "press",
                    "Left Click".to_string(),
                    None,
                    Some("left"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_LBUTTONUP => emit_event(make_event(
                    "mouse",
                    "release",
                    "Left Release".to_string(),
                    None,
                    Some("left"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_RBUTTONDOWN => emit_event(make_event(
                    "mouse",
                    "press",
                    "Right Click".to_string(),
                    None,
                    Some("right"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_RBUTTONUP => emit_event(make_event(
                    "mouse",
                    "release",
                    "Right Release".to_string(),
                    None,
                    Some("right"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_MBUTTONDOWN => emit_event(make_event(
                    "scroll",
                    "press",
                    "Middle Click".to_string(),
                    None,
                    Some("middle"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_MBUTTONUP => emit_event(make_event(
                    "scroll",
                    "release",
                    "Middle Release".to_string(),
                    None,
                    Some("middle"),
                    None,
                    Some(mouse.pt.x),
                    Some(mouse.pt.y),
                )),
                WM_MOUSEWHEEL => {
                    let wheel_delta = ((mouse.mouseData >> 16) & 0xffff) as i16;
                    let direction = if wheel_delta > 0 { "up" } else { "down" };
                    emit_event(make_event(
                        "scroll",
                        "wheel",
                        if direction == "up" {
                            "Scroll Up".to_string()
                        } else {
                            "Scroll Down".to_string()
                        },
                        None,
                        None,
                        Some(direction),
                        Some(mouse.pt.x),
                        Some(mouse.pt.y),
                    ));
                }
                WM_MOUSEMOVE => {
                    let tick = GetTickCount64();
                    let last_tick = LAST_MOVE_TICK.load(Ordering::Relaxed);
                    let last_x = LAST_MOVE_X.load(Ordering::Relaxed);
                    let last_y = LAST_MOVE_Y.load(Ordering::Relaxed);
                    let moved_enough = last_x == i32::MIN
                        || (mouse.pt.x - last_x).abs() + (mouse.pt.y - last_y).abs() >= 18;

                    if moved_enough && tick.saturating_sub(last_tick) >= 180 {
                        LAST_MOVE_TICK.store(tick, Ordering::Relaxed);
                        LAST_MOVE_X.store(mouse.pt.x, Ordering::Relaxed);
                        LAST_MOVE_Y.store(mouse.pt.y, Ordering::Relaxed);

                        emit_event(make_event(
                            "mouse",
                            "move",
                            format!("Move {}, {}", mouse.pt.x, mouse.pt.y),
                            None,
                            None,
                            None,
                            Some(mouse.pt.x),
                            Some(mouse.pt.y),
                        ));
                    }
                }
                _ => {}
            }
        }

        CallNextHookEx(None, code, w_param, l_param)
    }

    fn map_keyboard_key(keyboard: &KBDLLHOOKSTRUCT) -> Option<(&'static str, &'static str)> {
        let vk_code = keyboard.vkCode;
        let scan_code = keyboard.scanCode;

        match vk_code {
            0x08 => Some(("delete", "Backspace")),
            0x09 => Some(("tab", "Tab")),
            0x0D => Some(("return", "Return")),
            0x10 => {
                if scan_code == 0x36 {
                    Some(("shift2", "Right Shift"))
                } else {
                    Some(("shift", "Left Shift"))
                }
            }
            0x11 => Some(("control", "Ctrl")),
            0x12 => {
                if keyboard.flags.0 & 0x01 != 0 {
                    Some(("option2", "Right Alt"))
                } else {
                    Some(("option", "Left Alt"))
                }
            }
            0x14 => Some(("caps", "Caps Lock")),
            0x1B => Some(("esc", "Esc")),
            0x20 => Some(("space", "Space")),
            0x21 => Some(("pgup", "Page Up")),
            0x22 => Some(("pgdn", "Page Down")),
            0x23 => Some(("end", "End")),
            0x24 => Some(("home", "Home")),
            0x25 => Some(("left", "Arrow Left")),
            0x26 => Some(("up", "Arrow Up")),
            0x27 => Some(("right", "Arrow Right")),
            0x28 => Some(("down", "Arrow Down")),
            0x2D => Some(("insert", "Insert")),
            0x2E => Some(("nav_del", "Delete")),
            0x5B => Some(("command", "Left Meta")),
            0x5C => Some(("command2", "Right Meta")),
            0x60 => Some(("np0", "Numpad 0")),
            0x61 => Some(("np1", "Numpad 1")),
            0x62 => Some(("np2", "Numpad 2")),
            0x63 => Some(("np3", "Numpad 3")),
            0x64 => Some(("np4", "Numpad 4")),
            0x65 => Some(("np5", "Numpad 5")),
            0x66 => Some(("np6", "Numpad 6")),
            0x67 => Some(("np7", "Numpad 7")),
            0x68 => Some(("np8", "Numpad 8")),
            0x69 => Some(("np9", "Numpad 9")),
            0x6A => Some(("np*", "Numpad *")),
            0x6B => Some(("np+", "Numpad +")),
            0x6D => Some(("np-", "Numpad -")),
            0x6E => Some(("np.", "Numpad .")),
            0x6F => Some(("np/", "Numpad /")),
            0x70 => Some(("F1", "F1")),
            0x71 => Some(("F2", "F2")),
            0x72 => Some(("F3", "F3")),
            0x73 => Some(("F4", "F4")),
            0x74 => Some(("F5", "F5")),
            0x75 => Some(("F6", "F6")),
            0x76 => Some(("F7", "F7")),
            0x77 => Some(("F8", "F8")),
            0x78 => Some(("F9", "F9")),
            0x79 => Some(("F10", "F10")),
            0x7A => Some(("F11", "F11")),
            0x7B => Some(("F12", "F12")),
            0x90 => Some(("numlock", "Num Lock")),
            0xA0 => Some(("shift", "Left Shift")),
            0xA1 => Some(("shift2", "Right Shift")),
            0xA2 => Some(("control", "Left Ctrl")),
            0xA3 => Some(("control", "Right Ctrl")),
            0xA4 => Some(("option", "Left Alt")),
            0xA5 => Some(("option2", "Right Alt")),
            0xBA => Some((";", ";")),
            0xBB => Some(("=", "=")),
            0xBC => Some((",", ",")),
            0xBD => Some(("-", "-")),
            0xBE => Some((".", ".")),
            0xBF => Some(("/", "/")),
            0xC0 => Some(("`", "`")),
            0xDB => Some(("[", "[")),
            0xDC => Some(("\\", "\\")),
            0xDD => Some(("]", "]")),
            0xDE => Some(("'", "'")),
            value if (0x30..=0x39).contains(&value) => {
                let digit = char::from_u32(value)?;
                let text = match digit {
                    '0' => "0",
                    '1' => "1",
                    '2' => "2",
                    '3' => "3",
                    '4' => "4",
                    '5' => "5",
                    '6' => "6",
                    '7' => "7",
                    '8' => "8",
                    '9' => "9",
                    _ => return None,
                };
                Some((text, text))
            }
            value if (0x41..=0x5A).contains(&value) => {
                let text = match value {
                    0x41 => "A",
                    0x42 => "B",
                    0x43 => "C",
                    0x44 => "D",
                    0x45 => "E",
                    0x46 => "F",
                    0x47 => "G",
                    0x48 => "H",
                    0x49 => "I",
                    0x4A => "J",
                    0x4B => "K",
                    0x4C => "L",
                    0x4D => "M",
                    0x4E => "N",
                    0x4F => "O",
                    0x50 => "P",
                    0x51 => "Q",
                    0x52 => "R",
                    0x53 => "S",
                    0x54 => "T",
                    0x55 => "U",
                    0x56 => "V",
                    0x57 => "W",
                    0x58 => "X",
                    0x59 => "Y",
                    0x5A => "Z",
                    _ => return None,
                };
                Some((text, text))
            }
            _ => None,
        }
    }

    fn capitalize(value: &str) -> &'static str {
        match value {
            "press" => "Press",
            "release" => "Release",
            "move" => "Move",
            "wheel" => "Scroll",
            _ => "Event",
        }
    }

    #[derive(Debug)]
    pub enum HookInstallError {
        ModuleHandle(windows::core::Error),
        KeyboardHook(windows::core::Error),
        MouseHook(windows::core::Error),
    }

    impl fmt::Display for HookInstallError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            match self {
                Self::ModuleHandle(error) => write!(f, "failed to resolve module handle: {error}"),
                Self::KeyboardHook(error) => write!(f, "failed to install keyboard hook: {error}"),
                Self::MouseHook(error) => write!(f, "failed to install mouse hook: {error}"),
            }
        }
    }

    impl std::error::Error for HookInstallError {}
}
