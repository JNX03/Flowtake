use serde_json::Value;
use std::sync::Mutex;
use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn keyboard_start(state: State<'_, Mutex<AppState>>) -> AppResult<()> {
    let mut s = state.lock().unwrap();
    s.keyboard_tracker.start();
    Ok(())
}

#[tauri::command]
pub async fn keyboard_stop(state: State<'_, Mutex<AppState>>) -> AppResult<()> {
    let mut s = state.lock().unwrap();
    s.keyboard_tracker.stop();
    Ok(())
}

#[tauri::command]
pub async fn keyboard_get_events(
    state: State<'_, Mutex<AppState>>,
    start_timestamp: i64,
) -> AppResult<Vec<Value>> {
    let s = state.lock().unwrap();
    Ok(s.keyboard_tracker.get_events(start_timestamp))
}
