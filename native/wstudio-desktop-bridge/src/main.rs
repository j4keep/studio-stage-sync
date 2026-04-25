//! W.STUDIO Desktop Bridge — Milestone 1
//! Listens on ws://127.0.0.1:PORT (default 48001). The engineer web app sends binary frames of
//! little-endian float32 stereo interleaved PCM (same layout as the legacy AU bridge).
//! Audio is played on the **default output device** — set macOS default to BlackHole (or an
//! aggregate that includes it) so Logic can use that input.

use std::collections::VecDeque;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
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

fn run_cpal(fifo: Arc<Mutex<StereoFifo>>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or("no default output device — connect speakers or BlackHole")?;
    eprintln!(
        "[wstudio-bridge] Output device: {}",
        device.name().unwrap_or_else(|_| "(unknown)".into())
    );

    let supported = device.default_output_config()?;
    let sample_format = supported.sample_format();
    let config = supported.config();
    let channels = config.channels as usize;
    eprintln!(
        "[wstudio-bridge] Stream: {} Hz, {} channels, {:?}",
        config.sample_rate.0,
        channels,
        sample_format
    );

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
    eprintln!("[wstudio-bridge] Playing. Leave this terminal open. Ctrl+C to stop.");

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

    std::thread::spawn(move || {
        if let Err(e) = run_cpal(fifo_audio) {
            eprintln!("[wstudio-bridge] {e}");
            std::process::exit(1);
        }
    });

    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    let listener = TcpListener::bind(addr).await.map_err(|e| {
        if e.kind() == ErrorKind::AddrInUse {
            format!(
                "port {port} in use — quit the other bridge instance or pass a different port, e.g. {}",
                port + 1
            )
        } else {
            e.to_string()
        }
    })?;

    eprintln!(
        "[wstudio-bridge] WebSocket: ws://127.0.0.1:{port}\n\
         In the web app (engineer), set bridge output to **W.STUDIO Desktop Bridge**.\n\
         Tip: set system default output to **BlackHole 2ch**, then in Logic choose BlackHole as track input — or use an Aggregate Device."
    );

    loop {
        let (stream, _) = listener.accept().await?;
        let fifo = Arc::clone(&fifo);
        tokio::spawn(handle_client(stream, fifo));
    }
}
