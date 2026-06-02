// WStudioShmReader — mmaps /wstudio_slot1 written by the W.STUDIO Helper App.
//
// Shared memory layout MUST match native/wstudio-desktop-bridge/src/shm.rs.
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

#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdatomic.h>
#include <stdint.h>
#include <string.h>

namespace wstudio {

struct ShmHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t ring_samples;
    uint32_t _pad;
    _Atomic uint64_t write_index;
    _Atomic uint64_t read_index;
};

static constexpr uint32_t WST1_MAGIC = 0x57535431;

class ShmReader {
public:
    bool open(const char* name = "/wstudio_slot1") {
        fd_ = shm_open(name, O_RDWR, 0660);
        if (fd_ < 0) return false;
        struct stat st;
        if (fstat(fd_, &st) != 0) { ::close(fd_); fd_ = -1; return false; }
        size_ = st.st_size;
        void* map = mmap(nullptr, size_, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, 0);
        if (map == MAP_FAILED) { ::close(fd_); fd_ = -1; return false; }
        header_ = reinterpret_cast<ShmHeader*>(map);
        if (header_->magic != WST1_MAGIC) {
            munmap(map, size_); ::close(fd_); fd_ = -1; header_ = nullptr;
            return false;
        }
        samples_ = reinterpret_cast<float*>(reinterpret_cast<uint8_t*>(map) + sizeof(ShmHeader));
        return true;
    }

    // Drain up to `frames` samples into `out`. Missing samples are zero-filled.
    void read(float* out, uint32_t frames) {
        if (!header_) { memset(out, 0, frames * sizeof(float)); return; }
        uint64_t w = atomic_load_explicit(&header_->write_index, memory_order_acquire);
        uint64_t r = atomic_load_explicit(&header_->read_index, memory_order_relaxed);
        uint64_t avail = w > r ? (w - r) : 0;
        uint32_t take = avail < frames ? (uint32_t)avail : frames;
        uint32_t cap = header_->ring_samples;
        for (uint32_t i = 0; i < take; i++) {
            out[i] = samples_[(r + i) % cap];
        }
        if (take < frames) memset(out + take, 0, (frames - take) * sizeof(float));
        atomic_store_explicit(&header_->read_index, r + take, memory_order_release);
    }

private:
    int fd_ = -1;
    size_t size_ = 0;
    ShmHeader* header_ = nullptr;
    float* samples_ = nullptr;
};

} // namespace wstudio
