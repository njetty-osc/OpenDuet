//! Compatibility hooks. Telemetry collection and delivery have been removed.
use openbot_desktop_lib::{engine, telemetry};
use std::collections::BTreeMap;

pub fn initialize<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}
pub fn record<R: tauri::Runtime>(_app: &tauri::AppHandle<R>, _event: telemetry::EventData) {}
pub fn observe_engine<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    _status: &engine::EngineStatus,
) {
}
pub fn failure<R: tauri::Runtime>(_app: &tauri::AppHandle<R>, _error: telemetry::SetupErrorClass) {}
pub fn pull_completed<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    _metrics: openbot_desktop_lib::pull_metrics::PullMetrics,
) {
}
pub fn shutdown<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}
pub fn runtime_env<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> BTreeMap<String, String> {
    BTreeMap::from([
        ("DO_NOT_TRACK".into(), "1".into()),
        ("COPILOTKIT_TELEMETRY_DISABLED".into(), "true".into()),
        ("MASTRA_TELEMETRY_DISABLED".into(), "true".into()),
        ("SCARF_ANALYTICS".into(), "false".into()),
    ])
}
