//! POSIX shared-memory bridge to the W.STUDIO virtual CoreAudio driver.
//!
//! Contract (Phase 1, slot 1 only) — MUST match
//! `native/wstudio-coreaudio-driver/src/WStudioShmReader.cpp`:
//!
//!   shm name        : "/wstudio_slot1"
//!   region size     : sizeof(Header) + RING_SAMPLES * 4
//!   Header (little-endian, packed, 40 bytes):
//!     u32 magic         = 0x57535431 ("WST1")
//!     u32 version       = 1
//!     u32 sample_rate
//!     u32 channels      (1 in Phase 1)
//!     u32 ring_samples
//!     u32 _padding
//!     u64 write_index   (helper-owned, monotonically increasing)
//!     u64 read_index    (driver-owned)
//!   Followed by RING_SAMPLES Float32 samples.
//!
//! Single-producer (helper HTTP handler) → single-consumer (driver IO cycle).
//! No mutex: write_index / read_index are 8-byte aligned and used as
//! release/acquire cursors. On overflow we advance read_index forward —
//! recording silence is better than blocking the producer.

use std::path::Path;
use std::sync::atomic::{AtomicU64, AtomicPtr, Ordering};
use std::ptr;

const SHM_NAME: &[u8] = b"/wstudio_slot1\0";
const RING_SAMPLES: u32 = 48_000;        // 1s @ 48k mono
const WST1_MAGIC: u32 = 0x5753_5431;     // "WST1"
const WST1_VERSION: u32 = 1;
const HEADER_SIZE: usize = 40;
const REGION_SIZE: usize = HEADER_SIZE + (RING_SAMPLES as usize) * 4;

#[repr(C)]
struct Header {
    magic: u32,
    version: u32,
    sample_rate: u32,
    channels: u32,
    ring_samples: u32,
    _pad: u32,
    write_index: AtomicU64,
    read_index: AtomicU64,
}

/// Lazily-initialized mmap. Stored as a raw pointer so we can write to it
/// from any thread under our own SPSC discipline.
static REGION: AtomicPtr<u8> = AtomicPtr::new(ptr::null_mut());

/// True when the CoreAudio driver bundle is present on disk.
pub fn is_driver_installed() -> bool {
    Path::new("/Library/Audio/Plug-Ins/HAL/WStudio.driver").exists()
}

/// Open / create the shm region. Idempotent. Returns the base pointer or
/// null on failure (e.g. sandboxed environment).
fn ensure_region(sample_rate: u32, channels: u16) -> *mut u8 {
    let existing = REGION.load(Ordering::Acquire);
    if !existing.is_null() {
        return existing;
    }

    unsafe {
        // 0o660 — owner+group rw, world none.
        let fd = libc::shm_open(
            SHM_NAME.as_ptr() as *const libc::c_char,
            libc::O_CREAT | libc::O_RDWR,
            0o660,
        );
        if fd < 0 {
            return ptr::null_mut();
        }
        if libc::ftruncate(fd, REGION_SIZE as libc::off_t) != 0 {
            libc::close(fd);
            return ptr::null_mut();
        }
        let map = libc::mmap(
            ptr::null_mut(),
            REGION_SIZE,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_SHARED,
            fd,
            0,
        );
        // The fd can be closed once mmap'd; the mapping stays alive.
        libc::close(fd);
        if map == libc::MAP_FAILED {
            return ptr::null_mut();
        }
        let base = map as *mut u8;

        // Initialize the header if uninitialized (magic == 0). If a previous
        // helper process already initialized it we keep the existing
        // write_index / read_index so the driver's view stays consistent.
        let hdr = &*(base as *const Header);
        if hdr.magic == 0 {
            let hdr_mut = &mut *(base as *mut Header);
            hdr_mut.magic = WST1_MAGIC;
            hdr_mut.version = WST1_VERSION;
            hdr_mut.sample_rate = sample_rate;
            hdr_mut.channels = channels as u32;
            hdr_mut.ring_samples = RING_SAMPLES;
            hdr_mut._pad = 0;
            hdr_mut.write_index.store(0, Ordering::Release);
            hdr_mut.read_index.store(0, Ordering::Release);
        }
        // Use compare_exchange so concurrent initializers don't leak mappings.
        match REGION.compare_exchange(
            ptr::null_mut(),
            base,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => base,
            Err(other) => {
                // Someone else won the race — unmap ours.
                libc::munmap(base as *mut libc::c_void, REGION_SIZE);
                other
            }
        }
    }
}

/// Best-effort write of artist PCM into the shared ring.
/// Mono Float32 only in Phase 1. Multi-channel input is downmixed.
pub fn write_slot1(pcm: &[f32], sample_rate: u32, channels: u16) {
    if pcm.is_empty() {
        return;
    }
    let base = ensure_region(sample_rate, channels.max(1));
    if base.is_null() {
        return;
    }

    // Downmix to mono if the helper somehow received >1 channel.
    let mono_owned: Vec<f32>;
    let mono: &[f32] = if channels <= 1 {
        pcm
    } else {
        let ch = channels as usize;
        let frames = pcm.len() / ch;
        let mut v = Vec::with_capacity(frames);
        for f in 0..frames {
            let mut sum = 0f32;
            for c in 0..ch {
                sum += pcm[f * ch + c];
            }
            v.push(sum / ch as f32);
        }
        mono_owned = v;
        &mono_owned
    };

    unsafe {
        let hdr = &*(base as *const Header);
        let cap = hdr.ring_samples as u64;
        let samples_ptr = base.add(HEADER_SIZE) as *mut f32;

        let w_start = hdr.write_index.load(Ordering::Relaxed);
        let r_now = hdr.read_index.load(Ordering::Acquire);
        let n = mono.len() as u64;

        // Copy into ring, wrapping at cap. We do NOT block on a slow reader —
        // when n > free, we just bump read_index forward by the overflow so
        // the driver loses the oldest samples (recording dropouts) rather
        // than the producer stalling.
        let free = cap.saturating_sub(w_start.wrapping_sub(r_now));
        if n > free {
            let overflow = n - free;
            hdr.read_index.store(r_now + overflow, Ordering::Release);
        }

        for i in 0..(n as usize) {
            let idx = ((w_start + i as u64) % cap) as usize;
            *samples_ptr.add(idx) = mono[i];
        }

        // Publish: release-store new write_index so the driver sees a
        // consistent view of (write_index, samples) on its acquire-load.
        hdr.write_index.store(w_start + n, Ordering::Release);

        // Keep the format current in case the engineer's browser changed it.
        // Single 32-bit writes are atomic on macOS for aligned u32; the driver
        // re-reads these per IO cycle.
        let hdr_mut = &mut *(base as *mut Header);
        hdr_mut.sample_rate = sample_rate;
        hdr_mut.channels = 1; // post-downmix
    }
}
