//! W.STUDIO Helper App (Phase 1, macOS, single artist slot)
//!
//! Pipeline:
//!   Engineer browser
//!     POST http://127.0.0.1:48000/artist-audio/1   raw Float32 PCM
//!       → SlotRing (lock-free SPSC, ~500ms @ 48k mono)
//!         → POSIX shm `/wstudio_slot1`
//!           → "W.STUDIO Artist Input" virtual CoreAudio device
//!             → Logic / any DAW
//!
//! Also exposes:
//!   GET  /status                   helper + slot status
//!   POST /plugin-event             AU plugin control surface events
//!
//! Runs as a menubar agent (LSUIElement). No Dock icon, no window.
//!
//! NOTE: This is a Phase 1 scaffold. The shm writer + menubar tray are
//! intentionally minimal — they will be fleshed out once the CoreAudio
//! driver ships its matching shm reader contract.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_TYPE};
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;

mod slot_ring;
mod shm;

use slot_ring::SlotRing;

const HELPER_PORT: u16 = 48000;
const HELPER_VERSION: &str = env!("CARGO_PKG_VERSION");
const SLOT_CAPACITY_SAMPLES: usize = 48_000 / 2; // 500ms @ 48k mono

#[derive(Clone)]
struct AppState {
    slot1: Arc<SlotRing>,
    plugin: Arc<Mutex<PluginState>>,
    device_installed: Arc<Mutex<bool>>,
}

#[derive(Default, Clone, Serialize)]
struct PluginState {
    connected: bool,
    track_name: Option<String>,
    last_seen_at_ms: Option<u64>,
}

#[derive(Deserialize)]
struct PluginEvent {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    slot: Option<u32>,
    #[serde(default)]
    track_name: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn cors(mut r: Response<Full<Bytes>>) -> Response<Full<Bytes>> {
    let h = r.headers_mut();
    h.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    h.insert(ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("GET, POST, OPTIONS"));
    h.insert(ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("content-type, x-sample-rate, x-channels"));
    r
}

fn json(status: StatusCode, body: serde_json::Value) -> Response<Full<Bytes>> {
    let mut r = Response::new(Full::new(Bytes::from(body.to_string())));
    *r.status_mut() = status;
    r.headers_mut().insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    cors(r)
}

async fn handle(
    req: Request<Incoming>,
    state: AppState,
) -> Result<Response<Full<Bytes>>, hyper::Error> {
    if req.method() == Method::OPTIONS {
        return Ok(cors(Response::new(Full::new(Bytes::new()))));
    }

    let path = req.uri().path().to_string();
    let method = req.method().clone();

    match (method, path.as_str()) {
        (Method::GET, "/") | (Method::GET, "/index.html") => {
            let html = include_str!("status_page.html");
            let mut r = Response::new(Full::new(Bytes::from(html)));
            r.headers_mut().insert(CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"));
            return Ok(cors(r));
        }

        (Method::POST, "/test-tone") => {
            // Inject 200ms of 440Hz sine into slot 1 so user can verify the pipeline
            // without needing a browser session.
            let sr = 48_000u32;
            let n = (sr as usize) / 5; // 200ms
            let mut pcm = Vec::with_capacity(n);
            for i in 0..n {
                let t = i as f32 / sr as f32;
                pcm.push((t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.3);
            }
            state.slot1.write_samples(&pcm, sr, 1);
            return Ok(json(StatusCode::OK, serde_json::json!({ "ok": true, "wrote": n })));
        }

        (Method::GET, "/status") => {
            let s1 = state.slot1.snapshot();
            let plugin = state.plugin.lock().clone();
            let body = serde_json::json!({
                "ok": true,
                "helper": { "version": HELPER_VERSION },
                "device_installed": *state.device_installed.lock(),
                "slot_1": {
                    "connected": s1.last_write_at_ms.map(|t| now_ms().saturating_sub(t) < 2000).unwrap_or(false),
                    "level": s1.last_level,
                    "packets": s1.packets,
                    "failed": s1.failed,
                    "sample_rate": s1.sample_rate,
                    "channels": s1.channels,
                },
                "plugin": {
                    "connected": plugin.connected,
                    "trackName": plugin.track_name,
                    "lastSeenAt": plugin.last_seen_at_ms,
                },
            });
            Ok(json(StatusCode::OK, body))
        }

        (Method::POST, p) if p.starts_with("/artist-audio/") => {
            let slot: u32 = p["/artist-audio/".len()..].parse().unwrap_or(0);
            if slot != 1 {
                state.slot1.bump_failed();
                return Ok(json(StatusCode::NOT_FOUND, serde_json::json!({ "ok": false, "error": "phase1 only supports slot 1" })));
            }
            let sample_rate: u32 = req
                .headers()
                .get("x-sample-rate")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(48_000);
            let channels: u16 = req
                .headers()
                .get("x-channels")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(1);
            let body = match req.collect().await {
                Ok(c) => c.to_bytes(),
                Err(_) => {
                    state.slot1.bump_failed();
                    return Ok(json(StatusCode::BAD_REQUEST, serde_json::json!({ "ok": false })));
                }
            };
            // Body is raw Float32 PCM little-endian.
            if body.len() % 4 != 0 {
                state.slot1.bump_failed();
                return Ok(json(StatusCode::BAD_REQUEST, serde_json::json!({ "ok": false, "error": "PCM length must be a multiple of 4 bytes" })));
            }
            let n = body.len() / 4;
            let mut pcm = Vec::with_capacity(n);
            for i in 0..n {
                let off = i * 4;
                pcm.push(f32::from_le_bytes([body[off], body[off+1], body[off+2], body[off+3]]));
            }
            state.slot1.write_samples(&pcm, sample_rate, channels);
            // shm fan-out happens inside SlotRing::write_samples → shm::write_slot1.
            Ok(json(StatusCode::OK, serde_json::json!({ "ok": true, "wrote": n })))
        }

        (Method::POST, "/plugin-event") => {
            let body = match req.collect().await {
                Ok(c) => c.to_bytes(),
                Err(_) => return Ok(json(StatusCode::BAD_REQUEST, serde_json::json!({ "ok": false }))),
            };
            let ev: PluginEvent = match serde_json::from_slice(&body) {
                Ok(v) => v,
                Err(e) => return Ok(json(StatusCode::BAD_REQUEST, serde_json::json!({ "ok": false, "error": e.to_string() }))),
            };
            let mut p = state.plugin.lock();
            p.last_seen_at_ms = Some(now_ms());
            if ev.kind == "PLUGIN_HELLO" || ev.kind == "PLUGIN_STATE" {
                p.connected = true;
                if let Some(name) = ev.track_name {
                    p.track_name = Some(name);
                }
            }
            Ok(json(StatusCode::OK, serde_json::json!({ "ok": true })))
        }

        _ => Ok(json(StatusCode::NOT_FOUND, serde_json::json!({ "ok": false, "error": "not found" }))),
    }
}

async fn run_http(state: AppState) -> std::io::Result<()> {
    let addr = SocketAddr::from(([127, 0, 0, 1], HELPER_PORT));
    log_line(&format!("[http] attempting bind {addr}"));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => {
            log_line(&format!("[http] bind OK — listening on http://{addr}"));
            l
        }
        Err(e) => {
            log_line(&format!("[http] BIND FAILED on {addr}: {e} (kind={:?})", e.kind()));
            return Err(e);
        }
    };
    loop {
        let (stream, peer) = match listener.accept().await {
            Ok(v) => v,
            Err(e) => {
                log_line(&format!("[http] accept error: {e}"));
                continue;
            }
        };
        let _ = peer;
        let io = TokioIo::new(stream);
        let st = state.clone();
        tokio::spawn(async move {
            let _ = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service_fn(move |req| handle(req, st.clone())))
                .await;
        });
    }
}

/// Append a timestamped line to both stderr and ~/Library/Logs/WStudioHelper.log
/// so users can `tail -f` the log even when the app was launched from Finder
/// (where stderr is otherwise discarded).
fn log_line(msg: &str) {
    let line = format!("{} {}\n", now_ms(), msg);
    eprint!("{line}");
    if let Some(home) = std::env::var_os("HOME") {
        let mut path = std::path::PathBuf::from(home);
        path.push("Library/Logs");
        let _ = std::fs::create_dir_all(&path);
        path.push("WStudioHelper.log");
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            use std::io::Write;
            let _ = f.write_all(line.as_bytes());
        }
    }
}

fn install_panic_hook() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log_line(&format!("[panic] {info}"));
        default(info);
    }));
}

fn main() {
    install_panic_hook();
    log_line(&format!("[main] entered — helper v{HELPER_VERSION} pid={}", std::process::id()));

    let state = AppState {
        slot1: Arc::new(SlotRing::new(SLOT_CAPACITY_SAMPLES)),
        plugin: Arc::new(Mutex::new(PluginState::default())),
        device_installed: Arc::new(Mutex::new(shm::is_driver_installed())),
    };
    log_line("[main] state initialised");

    // HTTP server on a dedicated runtime thread so the macOS event loop owns main.
    let st = state.clone();
    std::thread::spawn(move || {
        log_line("[http-thread] spawned, building tokio runtime");
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(2)
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                log_line(&format!("[http-thread] FAILED to build tokio rt: {e}"));
                return;
            }
        };
        log_line("[http-thread] tokio runtime built, entering run_http");
        rt.block_on(async move {
            if let Err(e) = run_http(st).await {
                log_line(&format!("[http-thread] run_http exited with error: {e}"));
            } else {
                log_line("[http-thread] run_http exited cleanly (unexpected)");
            }
        });
        log_line("[http-thread] runtime block_on returned — thread exiting");
    });

    #[cfg(target_os = "macos")]
    {
        log_line("[main] starting macOS tray event loop");
        tray::run(state);
    }

    #[cfg(not(target_os = "macos"))]
    {
        log_line("Helper headless mode (non-macOS) — Ctrl-C to quit.");
        loop { std::thread::park(); }
    }
}


#[cfg(target_os = "macos")]
mod tray {
    use super::AppState;
    use tao::event::Event;
    use tao::event_loop::{ControlFlow, EventLoopBuilder};
    use tray_icon::{TrayIconBuilder, menu::{Menu, MenuItem, MenuEvent}};

    pub fn run(_state: AppState) {
        let event_loop = EventLoopBuilder::new().build();

        let menu = Menu::new();
        let status_item = MenuItem::new("W.STUDIO Helper — running on :48000", false, None);
        let open_item = MenuItem::new("Open Status Page", true, None);
        let quit_item = MenuItem::new("Quit W.STUDIO Helper", true, None);
        let _ = menu.append(&status_item);
        let _ = menu.append(&open_item);
        let _ = menu.append(&quit_item);

        // 16x16 transparent placeholder icon. Replace with branded glyph later.
        let icon = tray_icon::Icon::from_rgba(vec![0; 16 * 16 * 4], 16, 16).expect("icon");
        let _tray = TrayIconBuilder::new()
            .with_tooltip("W.STUDIO Helper")
            .with_menu(Box::new(menu))
            .with_icon(icon)
            .build()
            .expect("tray");

        let quit_id = quit_item.id().clone();
        let open_id = open_item.id().clone();
        event_loop.run(move |event, _, control_flow| {
            *control_flow = ControlFlow::Wait;
            if let Event::UserEvent(_) = event { /* no-op */ }
            if let Ok(ev) = MenuEvent::receiver().try_recv() {
                if ev.id == quit_id { *control_flow = ControlFlow::Exit; }
                else if ev.id == open_id {
                    let _ = std::process::Command::new("open")
                        .arg("http://127.0.0.1:48000/")
                        .spawn();
                }
            }
        });
    }
}

