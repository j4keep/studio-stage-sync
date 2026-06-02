//! POSIX shared-memory bridge to the W.STUDIO virtual CoreAudio driver.
//!
//! Contract (Phase 1, slot 1 only):
//!   shm name        : "/wstudio_slot1"
//!   region size     : sizeof(Header) + RING_SAMPLES * 4 bytes (Float32 mono)
//!   Header layout (packed, little-endian):
//!     u32 magic         = 0x57535431 ("WST1")
//!     u32 version       = 1
//!     u32 sample_rate
//!     u32 channels      (1 in Phase 1)
//!     u32 ring_samples
//!     u32 _padding
//!     u64 write_index   (sample-granularity, monotonically increasing)
//!     u64 read_index    (driver-owned)
//!   Followed by RING_SAMPLES Float32 samples.
//!
//! The CoreAudio driver mmaps the same region and reads from `read_index`
//! up to `write_index`. The helper only writes; the driver only advances
//! `read_index`. No locks: write_index/read_index are 64-bit aligned and
//! used as memory-fenced cursors.

use std::path::Path;

const SHM_NAME: &str = "/wstudio_slot1";
const _RING_SAMPLES: usize = 48_000; // 1s @ 48k mono

/// True when the CoreAudio driver bundle is present on disk. This is the
/// fastest reliable check — actually mapping shm only succeeds after the
/// driver has loaded, which requires `killall coreaudiod`.
pub fn is_driver_installed() -> bool {
    Path::new("/Library/Audio/Plug-Ins/HAL/WStudio.driver").exists()
}

/// Best-effort write of artist PCM into the shared ring.
///
/// Phase 1 stub: the actual mmap/CAS implementation lands together with the
/// CoreAudio driver in `native/wstudio-coreaudio-driver`. Until then this
/// is a no-op so the helper still runs end-to-end and the web UI can verify
/// /status, packet counters, and CORS without a driver present.
#[allow(unused_variables)]
pub fn write_slot1(pcm: &[f32], sample_rate: u32, channels: u16) {
    let _ = SHM_NAME;
    // TODO(phase1-driver): open `/wstudio_slot1` via shm_open + mmap,
    // validate header, append `pcm` into the ring starting at write_index,
    // then atomically bump write_index by pcm.len().
}
