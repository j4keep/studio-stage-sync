//! Per-slot ring buffer for inbound artist PCM.
//!
//! Phase 1: single producer (HTTP handler task) → single consumer
//! (shm writer that feeds the CoreAudio driver). The structure here is
//! intentionally simple — we hold a Mutex around the ring because the
//! producer rate is ~24 POSTs/sec at most. We'll move to a lock-free
//! ringbuf if profiling shows contention.

use parking_lot::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::shm;

struct RingInner {
    buf: Vec<f32>,
    head: usize, // write index
    tail: usize, // read index
    len: usize,
    cap: usize,
    sample_rate: u32,
    channels: u16,
    packets: u64,
    failed: u64,
    last_level: f32,
    last_write_at_ms: Option<u64>,
}

pub struct SlotRing {
    inner: Mutex<RingInner>,
}

#[derive(Clone, Copy)]
pub struct Snapshot {
    pub sample_rate: u32,
    pub channels: u16,
    pub packets: u64,
    pub failed: u64,
    pub last_level: f32,
    pub last_write_at_ms: Option<u64>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl SlotRing {
    pub fn new(capacity_samples: usize) -> Self {
        Self {
            inner: Mutex::new(RingInner {
                buf: vec![0.0; capacity_samples],
                head: 0,
                tail: 0,
                len: 0,
                cap: capacity_samples,
                sample_rate: 48_000,
                channels: 1,
                packets: 0,
                failed: 0,
                last_level: 0.0,
                last_write_at_ms: None,
            }),
        }
    }

    pub fn write_samples(&self, pcm: &[f32], sample_rate: u32, channels: u16) {
        let mut g = self.inner.lock();
        g.sample_rate = sample_rate;
        g.channels = channels;
        g.packets += 1;
        g.last_write_at_ms = Some(now_ms());

        // Compute RMS for status meter.
        let mut sum_sq = 0.0f32;
        for &s in pcm { sum_sq += s * s; }
        g.last_level = (sum_sq / pcm.len().max(1) as f32).sqrt().min(1.0);

        // Push into ring (overwrite oldest on overflow — DAW must be reading).
        let cap = g.cap;
        for &s in pcm {
            let head = g.head;
            g.buf[head] = s;
            g.head = (head + 1) % cap;
            if g.len == cap {
                g.tail = (g.tail + 1) % cap;
            } else {
                g.len += 1;
            }
        }

        // Fan out to shm for the CoreAudio driver. shm::write_slot1 is
        // best-effort — if the shm region doesn't exist yet (driver not
        // installed or coreaudiod hasn't loaded it), this is a no-op.
        shm::write_slot1(pcm, sample_rate, channels);
    }

    pub fn bump_failed(&self) {
        self.inner.lock().failed += 1;
    }

    pub fn snapshot(&self) -> Snapshot {
        let g = self.inner.lock();
        Snapshot {
            sample_rate: g.sample_rate,
            channels: g.channels,
            packets: g.packets,
            failed: g.failed,
            last_level: g.last_level,
            last_write_at_ms: g.last_write_at_ms,
        }
    }
}
