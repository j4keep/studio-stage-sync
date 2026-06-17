// WStudioShmReader — mmaps /wstudio_slot1 written by the W.STUDIO Helper App.
// Layout MUST match native/wstudio-desktop-bridge/src/shm.rs.
//
//   u32 magic         = 0x57535431 ("WST1")
//   u32 version       = 1
//   u32 sample_rate
//   u32 channels      (1 in Phase 1)
//   u32 ring_samples
//   u32 _padding
//   u64 write_index   (helper-owned, monotonically increasing)
//   u64 read_index    (driver-owned)
//   f32 samples[ring_samples]
//
// Header-only so the AudioServerPlugIn translation unit can inline the
// hot-path read into DoIOOperation.

#pragma once

#include <atomic>
#include <cstdint>
#include <cstring>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

namespace wstudio {

struct ShmHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t ring_samples;
    uint32_t _pad;
    std::atomic<uint64_t> write_index;
    std::atomic<uint64_t> read_index;
};
static_assert(sizeof(ShmHeader) == 40, "ShmHeader must be 40 bytes — matches Rust layout");

inline constexpr uint32_t kWST1Magic   = 0x57535431u;
inline constexpr uint32_t kWST1Version = 1u;

class ShmReader {
public:
    ShmReader() = default;

    ~ShmReader() {
        if (header_) {
            ::munmap(reinterpret_cast<void*>(header_), size_);
            header_ = nullptr;
        }
    }

    /// Try to open. Returns true if a valid header is present. Safe to call
    /// repeatedly; on failure the reader stays closed and `read()` zero-fills.
    bool open(const char* name = "/wstudio_slot1") {
        if (header_ != nullptr) return true;
        int fd = ::shm_open(name, O_RDWR, 0660);
        if (fd < 0) return false;
        struct stat st{};
        if (::fstat(fd, &st) != 0 || st.st_size < (off_t)sizeof(ShmHeader)) {
            ::close(fd); return false;
        }
        size_ = (size_t)st.st_size;
        void* map = ::mmap(nullptr, size_, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
        ::close(fd);
        if (map == MAP_FAILED) return false;

        auto* h = reinterpret_cast<ShmHeader*>(map);
        if (h->magic != kWST1Magic || h->version != kWST1Version) {
            ::munmap(map, size_); return false;
        }
        header_ = h;
        samples_ = reinterpret_cast<float*>(reinterpret_cast<uint8_t*>(map) + sizeof(ShmHeader));
        return true;
    }

    /// Drain up to `frames` mono Float32 samples into `out`. Missing samples
    /// are zero-filled so the DAW records silence rather than glitching.
    void read(float* out, uint32_t frames) noexcept {
        if (!header_) { std::memset(out, 0, frames * sizeof(float)); return; }
        uint64_t w = header_->write_index.load(std::memory_order_acquire);
        uint64_t r = header_->read_index.load(std::memory_order_relaxed);
        uint64_t avail = (w > r) ? (w - r) : 0;
        uint32_t take = avail < frames ? (uint32_t)avail : frames;
        uint32_t cap = header_->ring_samples;
        for (uint32_t i = 0; i < take; i++) {
            out[i] = samples_[(r + i) % cap];
        }
        if (take < frames) std::memset(out + take, 0, (frames - take) * sizeof(float));
        header_->read_index.store(r + take, std::memory_order_release);
    }

    uint32_t sampleRate() const noexcept { return header_ ? header_->sample_rate : 48000u; }
    uint32_t channels()   const noexcept { return header_ ? header_->channels   : 1u; }
    bool     isOpen()     const noexcept { return header_ != nullptr; }

private:
    ShmHeader* header_ = nullptr;
    float*     samples_ = nullptr;
    size_t     size_ = 0;
};

} // namespace wstudio
