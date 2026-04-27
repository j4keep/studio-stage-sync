//! W.STUDIO Desktop Bridge — Milestone 1
//! Listens on ws://127.0.0.1:PORT (default 48001). The engineer web app sends binary frames of
//! little-endian float32 stereo interleaved PCM (same layout as the legacy AU bridge).
//! Audio is played on the **default output device** — aim that device at whatever CoreAudio
//! input your DAW records from (virtual loopback, aggregate, or W.STUDIO input device).

use std::collections::VecDeque;
use std::io::ErrorKind;
use std::io::Write;
use std::net::SocketAddr;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tungstenite::Message;

/// Must match `VITE_WSTUDIO_DESKTOP_BRIDGE_PORT` in the web app (default 48001).
const DEFAULT_PORT: u16 = 48001;
/// Cap FIFO to avoid unbounded RAM if the browser runs ahead.
const MAX_FIFO_FLOATS: usize = 48000 * 2 * 12; // ~12 s @ 48k stereo

struct StereoFifo {
    q: VecDeque<f32>,
}

impl StereoFifo {
    fn new() -> Self {
        Self {
            q: VecDeque::with_capacity(MAX_FIFO_FLOATS.min(65536)),
        }
    }

    fn push_interleaved(&mut self, samples: &[f32]) {
        for &s in samples {
            while self.q.len() >= MAX_FIFO_FLOATS {
                self.q.pop_front();
            }
            self.q.push_back(s);
        }
    }

    /// Fill `out` interleaved stereo f32; pad with silence if underrun.
    fn pop_interleaved(&mut self, out: &mut [f32]) {
        for o in out.iter_mut() {
            *o = self.q.pop_front().unwrap_or(0.0);
        }
    }
}

fn bytes_to_f32_le(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn parse_port() -> u16 {
    std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

/// Finder-launched apps hide stderr; show a dialog so failures are visible.
#[cfg(target_os = "macos")]
fn show_macos_alert(message: &str) {
    let safe = message.replace('\\', "\\\\").replace('"', "'");
    let script = format!("display alert \"W.STUDIO Bridge\" message \"{safe}\" as informational");
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output();
}

#[cfg(not(target_os = "macos"))]
fn show_macos_alert(_message: &str) {}

/// Finder-launched apps hide stderr; mirror important lines here so support is possible.
fn log_line(msg: &str) {
    eprintln!("{msg}");
    #[cfg(target_os = "macos")]
    {
        let path = "/tmp/wstudio-bridge.log";
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(f, "{}", msg);
        }
    }
}

fn run_cpal(
    fifo: Arc<Mutex<StereoFifo>>,
    started_tx: Sender<Result<(), String>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or("no default output device — connect speakers or a virtual output")?;
    log_line(&format!(
        "[wstudio-bridge] Output device: {}",
        device.name().unwrap_or_else(|_| "(unknown)".into())
    ));

    let supported = device.default_output_config()?;
    let sample_format = supported.sample_format();
    let config = supported.config();
    let channels = config.channels as usize;
    log_line(&format!(
        "[wstudio-bridge] Stream: {} Hz, {} channels, {:?}",
        config.sample_rate.0,
        channels,
        sample_format
    ));

    let err_fn = |e: cpal::StreamError| eprintln!("[wstudio-bridge] stream error: {e}");

    let stream = match sample_format {
        SampleFormat::F32 => {
            let fifo = Arc::clone(&fifo);
            device.build_output_stream(
                &config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    if channels < 2 {
                        let frames = data.len();
                        let mut interleaved = vec![0.0f32; frames * 2];
                        if let Ok(mut f) = fifo.try_lock() {
                            f.pop_interleaved(&mut interleaved);
                            for i in 0..frames {
                                data[i] = interleaved[i * 2];
                            }
                        } else {
                            for s in data.iter_mut() {
                                *s = 0.0;
                            }
                        }
                    } else if let Ok(mut f) = fifo.try_lock() {
                        f.pop_interleaved(data);
                    } else {
                        for s in data.iter_mut() {
                            *s = 0.0;
                        }
                    }
                },
                err_fn,
                None,
            )?
        }
        SampleFormat::I16 => {
            let fifo = Arc::clone(&fifo);
            device.build_output_stream(
                &config,
                move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                    let mut interleaved = vec![0.0f32; data.len()];
                    if let Ok(mut f) = fifo.try_lock() {
                        f.pop_interleaved(&mut interleaved);
                    }
                    for (i, o) in data.iter_mut().enumerate() {
                        let v = interleaved.get(i).copied().unwrap_or(0.0);
                        *o = (v.clamp(-1.0, 1.0) * 32767.0) as i16;
                    }
                },
                err_fn,
                None,
            )?
        }
        other => {
            return Err(format!("unsupported sample format {other:?} — try another output device").into());
        }
    };

    stream.play()?;
    let _ = started_tx.send(Ok(()));
    log_line("[wstudio-bridge] Playing. Leave this process running (or keep the app open).");

    std::thread::park();
    Ok(())
}

async fn handle_client(stream: TcpStream, fifo: Arc<Mutex<StereoFifo>>) {
    let mut ws = match accept_async(stream).await {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[wstudio-bridge] WebSocket handshake failed: {e}");
            return;
        }
    };
    eprintln!("[wstudio-bridge] Browser connected — receiving PCM");

    loop {
        match ws.next().await {
            Some(Ok(Message::Binary(b))) => {
                if b.len() < 8 || b.len() % 8 != 0 {
                    continue;
                }
                let floats = bytes_to_f32_le(&b);
                if let Ok(mut f) = fifo.lock() {
                    f.push_interleaved(&floats);
                }
            }
            Some(Ok(Message::Close(_))) | None => break,
            Some(Ok(Message::Ping(p))) => {
                let _ = ws.send(Message::Pong(p)).await;
            }
            Some(Ok(_)) => {}
            Some(Err(e)) => {
                eprintln!("[wstudio-bridge] WebSocket error: {e}");
                break;
            }
        }
    }
    eprintln!("[wstudio-bridge] Browser disconnected");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = parse_port();
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();

    let fifo = Arc::new(Mutex::new(StereoFifo::new()));
    let fifo_audio = Arc::clone(&fifo);

    let (audio_started_tx, audio_started_rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let tx_cpal = audio_started_tx.clone();
    let tx_err = audio_started_tx.clone();
    drop(audio_started_tx);
    std::thread::spawn(move || {
        if let Err(e) = run_cpal(fifo_audio, tx_cpal) {
            let msg = format!("{e}");
            log_line(&format!("[wstudio-bridge] {msg}"));
            let _ = tx_err.send(Err(msg));
        }
    });

    match audio_started_rx.recv_timeout(Duration::from_secs(8)) {
        Ok(Ok(())) => {}
        Ok(Err(msg)) => {
            let full = format!("Audio output failed: {msg}\n\nTip: System Settings → Sound → pick a working output (built-in speakers, headphones, or your loopback). If this persists, see /tmp/wstudio-bridge.log");
            log_line(&full);
            show_macos_alert(&full);
            return Err(full.into());
        }
        Err(_) => {
            let full = "The bridge audio engine did not start in time (or the audio thread stopped).\n\nTip: quit other copies of W.STUDIO Bridge, check Sound output in System Settings, then try again. Details: /tmp/wstudio-bridge.log";
            log_line(full);
            show_macos_alert(full);
            return Err(full.into());
        }
    }

    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            let detail = if e.kind() == ErrorKind::AddrInUse {
                format!(
                    "Port {port} is already in use. Quit the other W.STUDIO Bridge (or Terminal npm run wstudio:bridge), then try again."
                )
            } else {
                e.to_string()
            };
            show_macos_alert(&detail);
            return Err(detail.into());
        }
    };

    log_line(&format!(
        "[wstudio-bridge] WebSocket: ws://127.0.0.1:{port}\n\
         In the web app (engineer), set bridge output to **W.STUDIO Desktop Bridge**.\n\
         Tip: set Sound output to the device your DAW records from (virtual loopback or W.STUDIO aggregate), then arm that input on a track in Logic."
    ));

    loop {
        let (stream, _) = listener.accept().await?;
        let fifo = Arc::clone(&fifo);
        tokio::spawn(handle_client(stream, fifo));
    }
}
