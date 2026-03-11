//! Single-instance guard: prevent the app from running more than once.

use std::sync::OnceLock;

#[cfg(windows)]
#[allow(dead_code)]
struct SingletonHandle(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for SingletonHandle {}
#[cfg(windows)]
unsafe impl Sync for SingletonHandle {}

#[cfg(windows)]
static SINGLETON_HANDLE: OnceLock<SingletonHandle> = OnceLock::new();

/// Tries to acquire the single-instance lock. Returns `true` if this process is the only instance
/// (or on non-Windows). Returns `false` if another instance is already running; the caller should exit.
pub fn acquire_single_instance() -> bool {
    #[cfg(not(windows))]
    return true;

    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS};
        use windows::Win32::System::Threading::CreateMutexW;

        // Named mutex: "Local\\" prefix = session-local so one instance per user session.
        let name: [u16; 26] = [
            'L' as u16, 'o' as u16, 'c' as u16, 'a' as u16, 'l' as u16, '\\' as u16,
            'M' as u16, 'y' as u16, 'T' as u16, 'i' as u16, 'm' as u16, 'e' as u16,
            'S' as u16, 'i' as u16, 'n' as u16, 'g' as u16, 'l' as u16, 'e' as u16,
            'I' as u16, 'n' as u16, 's' as u16, 't' as u16, 'a' as u16, 'n' as u16,
            'c' as u16, 'e' as u16,
        ];
        let name_null: [u16; 27] = {
            let mut n = [0u16; 27];
            n[..26].copy_from_slice(&name);
            n[26] = 0;
            n
        };
        let name = PCWSTR::from_raw(name_null.as_ptr());

        let handle = unsafe { CreateMutexW(None, false, name) };
        let Ok(handle) = handle else {
            return true; // creation failed for other reason; allow run to avoid blocking user
        };

        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            let _ = unsafe { CloseHandle(handle) };
            return false;
        }

        let _ = SINGLETON_HANDLE.set(SingletonHandle(handle));
        true
    }
}
