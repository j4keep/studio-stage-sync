// W.STUDIO Virtual CoreAudio Driver — Phase 1 (single input device, slot 1).
//
// Implements an AudioServerPlugIn that:
//   - exposes one device   "W.STUDIO Artist Input"
//   - exposes one stream   1×Float32 @ 48 kHz, mono
//   - on every IO cycle drains POSIX shm `/wstudio_slot1`, written by the
//     W.STUDIO Helper App, into the DAW's input buffer.
//
// Object map (driver-owned, opaque to the host):
//   1  kAudioObjectPlugInObject (host-defined constant)
//   2  Device
//   3  Input stream
//
// Build:  ../build.sh
// Install: see ../README.md
//
// Loosely modelled on Apple's NullAudio.c sample.

#include <CoreAudio/AudioServerPlugIn.h>
#include <CoreFoundation/CoreFoundation.h>
#include <mach/mach_time.h>

#include <atomic>
#include <cstring>
#include <pthread.h>

#include "WStudioShmReader.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// IDs and constants
// ─────────────────────────────────────────────────────────────────────────────
static constexpr AudioObjectID kObjectID_PlugIn = kAudioObjectPlugInObject; // == 1
static constexpr AudioObjectID kObjectID_Device = 2;
static constexpr AudioObjectID kObjectID_Stream = 3;

static constexpr Float64       kFixedSampleRate = 48000.0;
static constexpr UInt32        kRingBufferFrames = 16384;        // device-side ring
static constexpr UInt32        kSafetyOffsetFrames = 128;
static constexpr UInt32        kZeroTimeStampPeriod = kRingBufferFrames;

#define kDeviceName         CFSTR("W.STUDIO Artist Input")
#define kDeviceManufacturer CFSTR("Wheuat")
#define kDeviceUID          CFSTR("com.wheuat.wstudio.artist-input")
#define kModelUID           CFSTR("com.wheuat.wstudio.artist-input.model")
#define kBundleID           CFSTR("com.wheuat.wstudio.driver")

// ─────────────────────────────────────────────────────────────────────────────
// Plug-in state
// ─────────────────────────────────────────────────────────────────────────────
namespace {

struct DriverState {
    pthread_mutex_t          stateLock = PTHREAD_MUTEX_INITIALIZER;
    AudioServerPlugInHostRef host = nullptr;

    // Stream / device
    std::atomic<bool>   deviceIsRunning { false };
    std::atomic<UInt64> ioRunCount { 0 };
    Float64             sampleRate = kFixedSampleRate;

    // Anchor for GetZeroTimeStamp — host pulls input relative to these.
    pthread_mutex_t     ioLock = PTHREAD_MUTEX_INITIALIZER;
    UInt64              anchorHostTime = 0;
    Float64             anchorSampleTime = 0.0;
    UInt64              hostTicksPerFrame = 0;

    wstudio::ShmReader  shm;
};

DriverState* gState = nullptr;

// COM reference count for the plug-in instance.
std::atomic<UInt32> gRefCount { 1 };

UInt64 hostTicksPerFrameFor(Float64 sampleRate) {
    mach_timebase_info_data_t tb;
    mach_timebase_info(&tb);
    // hostTime is in absolute ticks. Ticks per second = (1e9 * denom) / numer.
    Float64 ticksPerSecond = (1.0e9 * (Float64)tb.denom) / (Float64)tb.numer;
    return (UInt64)(ticksPerSecond / sampleRate);
}

// Build a kAudioStreamBasicDescription for 48k Float32 mono packed.
AudioStreamBasicDescription monoFloat32ASBD() {
    AudioStreamBasicDescription a{};
    a.mSampleRate = kFixedSampleRate;
    a.mFormatID = kAudioFormatLinearPCM;
    a.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagsNativeEndian
                   | kAudioFormatFlagIsPacked;
    a.mBytesPerPacket = 4;
    a.mFramesPerPacket = 1;
    a.mBytesPerFrame = 4;
    a.mChannelsPerFrame = 1;
    a.mBitsPerChannel = 32;
    return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property helpers
// ─────────────────────────────────────────────────────────────────────────────
#define BAIL_IF(cond, err) do { if (cond) return (err); } while (0)

OSStatus writeString(CFStringRef s, UInt32 inSize, UInt32* outSize, void* outData) {
    BAIL_IF(inSize < sizeof(CFStringRef), kAudioHardwareBadPropertySizeError);
    *static_cast<CFStringRef*>(outData) = (CFStringRef)CFRetain(s);
    *outSize = sizeof(CFStringRef);
    return noErr;
}

OSStatus writeU32(UInt32 v, UInt32 inSize, UInt32* outSize, void* outData) {
    BAIL_IF(inSize < sizeof(UInt32), kAudioHardwareBadPropertySizeError);
    *static_cast<UInt32*>(outData) = v;
    *outSize = sizeof(UInt32);
    return noErr;
}

OSStatus writeF64(Float64 v, UInt32 inSize, UInt32* outSize, void* outData) {
    BAIL_IF(inSize < sizeof(Float64), kAudioHardwareBadPropertySizeError);
    *static_cast<Float64*>(outData) = v;
    *outSize = sizeof(Float64);
    return noErr;
}

OSStatus writeASBD(const AudioStreamBasicDescription& a, UInt32 inSize, UInt32* outSize, void* outData) {
    BAIL_IF(inSize < sizeof(AudioStreamBasicDescription), kAudioHardwareBadPropertySizeError);
    *static_cast<AudioStreamBasicDescription*>(outData) = a;
    *outSize = sizeof(AudioStreamBasicDescription);
    return noErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// PlugIn property dispatch
// ─────────────────────────────────────────────────────────────────────────────
OSStatus PlugIn_HasProperty(const AudioObjectPropertyAddress* a, Boolean* out) {
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass:
        case kAudioObjectPropertyClass:
        case kAudioObjectPropertyOwner:
        case kAudioObjectPropertyManufacturer:
        case kAudioObjectPropertyOwnedObjects:
        case kAudioPlugInPropertyDeviceList:
        case kAudioPlugInPropertyTranslateUIDToDevice:
            *out = true; return noErr;
        default: *out = false; return noErr;
    }
}

OSStatus PlugIn_GetData(const AudioObjectPropertyAddress* a, UInt32 inQDS, const void* inQD,
                        UInt32 inDataSize, UInt32* outDataSize, void* outData) {
    (void)inQDS; (void)inQD;
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass: return writeU32(kAudioObjectClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyClass:     return writeU32(kAudioPlugInClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyOwner:     return writeU32(kAudioObjectUnknown, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyManufacturer: return writeString(kDeviceManufacturer, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyOwnedObjects:
        case kAudioPlugInPropertyDeviceList: {
            UInt32 n = inDataSize / sizeof(AudioObjectID);
            if (n >= 1) {
                static_cast<AudioObjectID*>(outData)[0] = kObjectID_Device;
                *outDataSize = sizeof(AudioObjectID);
            } else {
                *outDataSize = 0;
            }
            return noErr;
        }
        case kAudioPlugInPropertyTranslateUIDToDevice: {
            BAIL_IF(inQDS < sizeof(CFStringRef), kAudioHardwareBadPropertySizeError);
            CFStringRef uid = *static_cast<const CFStringRef*>(inQD);
            AudioObjectID out = (uid && CFStringCompare(uid, kDeviceUID, 0) == kCFCompareEqualTo)
                              ? kObjectID_Device : kAudioObjectUnknown;
            return writeU32(out, inDataSize, outDataSize, outData);
        }
        default: return kAudioHardwareUnknownPropertyError;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Device property dispatch
// ─────────────────────────────────────────────────────────────────────────────
OSStatus Device_HasProperty(const AudioObjectPropertyAddress* a, Boolean* out) {
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass:
        case kAudioObjectPropertyClass:
        case kAudioObjectPropertyOwner:
        case kAudioObjectPropertyName:
        case kAudioObjectPropertyManufacturer:
        case kAudioObjectPropertyOwnedObjects:
        case kAudioDevicePropertyDeviceUID:
        case kAudioDevicePropertyModelUID:
        case kAudioDevicePropertyTransportType:
        case kAudioDevicePropertyStreams:
        case kAudioDevicePropertyDeviceIsRunning:
        case kAudioDevicePropertyNominalSampleRate:
        case kAudioDevicePropertyAvailableNominalSampleRates:
        case kAudioDevicePropertyIsHidden:
        case kAudioDevicePropertyZeroTimeStampPeriod:
        case kAudioDevicePropertySafetyOffset:
        case kAudioDevicePropertyLatency:
        case kAudioDevicePropertyDeviceCanBeDefaultDevice:
        case kAudioDevicePropertyDeviceCanBeDefaultSystemDevice:
        case kAudioDevicePropertyStreamConfiguration:
            *out = true; return noErr;
        default: *out = false; return noErr;
    }
}

OSStatus Device_GetData(const AudioObjectPropertyAddress* a, UInt32 inQDS, const void* inQD,
                        UInt32 inDataSize, UInt32* outDataSize, void* outData) {
    (void)inQDS; (void)inQD;
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass:   return writeU32(kAudioObjectClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyClass:       return writeU32(kAudioDeviceClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyOwner:       return writeU32(kObjectID_PlugIn, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyName:        return writeString(kDeviceName, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyManufacturer:return writeString(kDeviceManufacturer, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyDeviceUID:   return writeString(kDeviceUID, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyModelUID:    return writeString(kModelUID, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyTransportType: return writeU32(kAudioDeviceTransportTypeVirtual, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyIsHidden:    return writeU32(0, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyZeroTimeStampPeriod: return writeU32(kZeroTimeStampPeriod, inDataSize, outDataSize, outData);
        case kAudioDevicePropertySafetyOffset: return writeU32(kSafetyOffsetFrames, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyLatency:     return writeU32(0, inDataSize, outDataSize, outData);
        case kAudioDevicePropertyDeviceCanBeDefaultDevice:
        case kAudioDevicePropertyDeviceCanBeDefaultSystemDevice:
            return writeU32(0, inDataSize, outDataSize, outData);

        case kAudioObjectPropertyOwnedObjects:
        case kAudioDevicePropertyStreams: {
            // Input streams only.
            if (a->mScope == kAudioObjectPropertyScopeOutput) { *outDataSize = 0; return noErr; }
            UInt32 n = inDataSize / sizeof(AudioObjectID);
            if (n >= 1) {
                static_cast<AudioObjectID*>(outData)[0] = kObjectID_Stream;
                *outDataSize = sizeof(AudioObjectID);
            } else { *outDataSize = 0; }
            return noErr;
        }

        case kAudioDevicePropertyDeviceIsRunning:
            return writeU32(gState->deviceIsRunning.load() ? 1 : 0, inDataSize, outDataSize, outData);

        case kAudioDevicePropertyNominalSampleRate:
            return writeF64(gState->sampleRate, inDataSize, outDataSize, outData);

        case kAudioDevicePropertyAvailableNominalSampleRates: {
            UInt32 n = inDataSize / sizeof(AudioValueRange);
            if (n >= 1) {
                AudioValueRange r{ kFixedSampleRate, kFixedSampleRate };
                static_cast<AudioValueRange*>(outData)[0] = r;
                *outDataSize = sizeof(AudioValueRange);
            } else { *outDataSize = 0; }
            return noErr;
        }

        case kAudioDevicePropertyStreamConfiguration: {
            // input scope only
            if (a->mScope == kAudioObjectPropertyScopeOutput) { *outDataSize = sizeof(AudioBufferList); return noErr; }
            UInt32 needed = offsetof(AudioBufferList, mBuffers) + sizeof(AudioBuffer);
            BAIL_IF(inDataSize < needed, kAudioHardwareBadPropertySizeError);
            auto* bl = static_cast<AudioBufferList*>(outData);
            bl->mNumberBuffers = 1;
            bl->mBuffers[0].mNumberChannels = 1;
            bl->mBuffers[0].mDataByteSize = 0;
            bl->mBuffers[0].mData = nullptr;
            *outDataSize = needed;
            return noErr;
        }

        default: return kAudioHardwareUnknownPropertyError;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream property dispatch
// ─────────────────────────────────────────────────────────────────────────────
OSStatus Stream_HasProperty(const AudioObjectPropertyAddress* a, Boolean* out) {
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass:
        case kAudioObjectPropertyClass:
        case kAudioObjectPropertyOwner:
        case kAudioObjectPropertyName:
        case kAudioStreamPropertyIsActive:
        case kAudioStreamPropertyDirection:
        case kAudioStreamPropertyTerminalType:
        case kAudioStreamPropertyStartingChannel:
        case kAudioStreamPropertyLatency:
        case kAudioStreamPropertyVirtualFormat:
        case kAudioStreamPropertyPhysicalFormat:
        case kAudioStreamPropertyAvailableVirtualFormats:
        case kAudioStreamPropertyAvailablePhysicalFormats:
            *out = true; return noErr;
        default: *out = false; return noErr;
    }
}

OSStatus Stream_GetData(const AudioObjectPropertyAddress* a, UInt32 inQDS, const void* inQD,
                        UInt32 inDataSize, UInt32* outDataSize, void* outData) {
    (void)inQDS; (void)inQD;
    switch (a->mSelector) {
        case kAudioObjectPropertyBaseClass:   return writeU32(kAudioObjectClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyClass:       return writeU32(kAudioStreamClassID, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyOwner:       return writeU32(kObjectID_Device, inDataSize, outDataSize, outData);
        case kAudioObjectPropertyName:        return writeString(CFSTR("W.STUDIO Artist 1"), inDataSize, outDataSize, outData);
        case kAudioStreamPropertyIsActive:    return writeU32(1, inDataSize, outDataSize, outData);
        case kAudioStreamPropertyDirection:   return writeU32(1, inDataSize, outDataSize, outData); // 1 = input
        case kAudioStreamPropertyTerminalType:return writeU32(kAudioStreamTerminalTypeMicrophone, inDataSize, outDataSize, outData);
        case kAudioStreamPropertyStartingChannel: return writeU32(1, inDataSize, outDataSize, outData);
        case kAudioStreamPropertyLatency:     return writeU32(0, inDataSize, outDataSize, outData);

        case kAudioStreamPropertyVirtualFormat:
        case kAudioStreamPropertyPhysicalFormat:
            return writeASBD(monoFloat32ASBD(), inDataSize, outDataSize, outData);

        case kAudioStreamPropertyAvailableVirtualFormats:
        case kAudioStreamPropertyAvailablePhysicalFormats: {
            UInt32 n = inDataSize / sizeof(AudioStreamRangedDescription);
            if (n >= 1) {
                AudioStreamRangedDescription d{};
                d.mFormat = monoFloat32ASBD();
                d.mSampleRateRange.mMinimum = kFixedSampleRate;
                d.mSampleRateRange.mMaximum = kFixedSampleRate;
                static_cast<AudioStreamRangedDescription*>(outData)[0] = d;
                *outDataSize = sizeof(AudioStreamRangedDescription);
            } else { *outDataSize = 0; }
            return noErr;
        }

        default: return kAudioHardwareUnknownPropertyError;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioServerPlugInDriverInterface vtable
// ─────────────────────────────────────────────────────────────────────────────
HRESULT WStudio_QueryInterface(void* drv, REFIID uuid, LPVOID* outIface);
ULONG   WStudio_AddRef(void* drv);
ULONG   WStudio_Release(void* drv);

OSStatus WStudio_Initialize(AudioServerPlugInDriverRef drv, AudioServerPlugInHostRef host) {
    (void)drv;
    gState->host = host;
    gState->hostTicksPerFrame = hostTicksPerFrameFor(gState->sampleRate);
    gState->shm.open(); // best-effort; helper may not be writing yet
    return noErr;
}

OSStatus WStudio_CreateDevice(AudioServerPlugInDriverRef, CFDictionaryRef, const AudioServerPlugInClientInfo*, AudioObjectID*)
    { return kAudioHardwareUnsupportedOperationError; }
OSStatus WStudio_DestroyDevice(AudioServerPlugInDriverRef, AudioObjectID)
    { return kAudioHardwareUnsupportedOperationError; }
OSStatus WStudio_AddDeviceClient(AudioServerPlugInDriverRef, AudioObjectID, const AudioServerPlugInClientInfo*) { return noErr; }
OSStatus WStudio_RemoveDeviceClient(AudioServerPlugInDriverRef, AudioObjectID, const AudioServerPlugInClientInfo*) { return noErr; }
OSStatus WStudio_PerformDeviceConfigurationChange(AudioServerPlugInDriverRef, AudioObjectID, UInt64, void*) { return noErr; }
OSStatus WStudio_AbortDeviceConfigurationChange(AudioServerPlugInDriverRef, AudioObjectID, UInt64, void*) { return noErr; }

Boolean  WStudio_HasProperty(AudioServerPlugInDriverRef, AudioObjectID objId, pid_t, const AudioObjectPropertyAddress* a) {
    Boolean has = false;
    switch (objId) {
        case kObjectID_PlugIn: PlugIn_HasProperty(a, &has); break;
        case kObjectID_Device: Device_HasProperty(a, &has); break;
        case kObjectID_Stream: Stream_HasProperty(a, &has); break;
    }
    return has;
}
OSStatus WStudio_IsPropertySettable(AudioServerPlugInDriverRef, AudioObjectID, pid_t, const AudioObjectPropertyAddress*, Boolean* outSettable) {
    *outSettable = false; return noErr;
}
OSStatus WStudio_GetPropertyDataSize(AudioServerPlugInDriverRef d, AudioObjectID objId, pid_t pid,
                                     const AudioObjectPropertyAddress* a, UInt32 inQDS, const void* inQD,
                                     UInt32* outSize) {
    // Conservative — return generous sizes; the host re-queries with GetPropertyData.
    switch (a->mSelector) {
        case kAudioObjectPropertyOwnedObjects:
        case kAudioPlugInPropertyDeviceList:
        case kAudioDevicePropertyStreams:           *outSize = sizeof(AudioObjectID); return noErr;
        case kAudioDevicePropertyAvailableNominalSampleRates: *outSize = sizeof(AudioValueRange); return noErr;
        case kAudioDevicePropertyStreamConfiguration:
            *outSize = offsetof(AudioBufferList, mBuffers) + sizeof(AudioBuffer); return noErr;
        case kAudioStreamPropertyAvailableVirtualFormats:
        case kAudioStreamPropertyAvailablePhysicalFormats:
            *outSize = sizeof(AudioStreamRangedDescription); return noErr;
        case kAudioStreamPropertyVirtualFormat:
        case kAudioStreamPropertyPhysicalFormat:    *outSize = sizeof(AudioStreamBasicDescription); return noErr;
        case kAudioObjectPropertyName:
        case kAudioObjectPropertyManufacturer:
        case kAudioDevicePropertyDeviceUID:
        case kAudioDevicePropertyModelUID:          *outSize = sizeof(CFStringRef); return noErr;
        case kAudioDevicePropertyNominalSampleRate: *outSize = sizeof(Float64); return noErr;
        default:                                    *outSize = sizeof(UInt32); return noErr;
    }
    (void)d; (void)objId; (void)pid; (void)inQDS; (void)inQD;
}
OSStatus WStudio_GetPropertyData(AudioServerPlugInDriverRef, AudioObjectID objId, pid_t,
                                 const AudioObjectPropertyAddress* a, UInt32 inQDS, const void* inQD,
                                 UInt32 inDataSize, UInt32* outDataSize, void* outData) {
    switch (objId) {
        case kObjectID_PlugIn: return PlugIn_GetData(a, inQDS, inQD, inDataSize, outDataSize, outData);
        case kObjectID_Device: return Device_GetData(a, inQDS, inQD, inDataSize, outDataSize, outData);
        case kObjectID_Stream: return Stream_GetData(a, inQDS, inQD, inDataSize, outDataSize, outData);
        default: return kAudioHardwareBadObjectError;
    }
}
OSStatus WStudio_SetPropertyData(AudioServerPlugInDriverRef, AudioObjectID, pid_t,
                                 const AudioObjectPropertyAddress*, UInt32, const void*, UInt32, const void*) {
    return kAudioHardwareUnsupportedOperationError;
}

OSStatus WStudio_StartIO(AudioServerPlugInDriverRef, AudioObjectID objId, UInt32) {
    if (objId != kObjectID_Device) return kAudioHardwareBadObjectError;
    pthread_mutex_lock(&gState->ioLock);
    gState->anchorHostTime = mach_absolute_time();
    gState->anchorSampleTime = 0.0;
    pthread_mutex_unlock(&gState->ioLock);
    gState->deviceIsRunning.store(true);
    gState->shm.open();
    return noErr;
}
OSStatus WStudio_StopIO(AudioServerPlugInDriverRef, AudioObjectID objId, UInt32) {
    if (objId != kObjectID_Device) return kAudioHardwareBadObjectError;
    gState->deviceIsRunning.store(false);
    return noErr;
}

OSStatus WStudio_GetZeroTimeStamp(AudioServerPlugInDriverRef, AudioObjectID objId, UInt32,
                                  Float64* outSample, UInt64* outHostTime, UInt64* outSeed) {
    if (objId != kObjectID_Device) return kAudioHardwareBadObjectError;
    pthread_mutex_lock(&gState->ioLock);
    UInt64 nowHost = mach_absolute_time();
    UInt64 ticksPerCycle = gState->hostTicksPerFrame * (UInt64)kZeroTimeStampPeriod;
    while (nowHost - gState->anchorHostTime >= ticksPerCycle) {
        gState->anchorHostTime += ticksPerCycle;
        gState->anchorSampleTime += (Float64)kZeroTimeStampPeriod;
    }
    *outSample = gState->anchorSampleTime;
    *outHostTime = gState->anchorHostTime;
    *outSeed = 1;
    pthread_mutex_unlock(&gState->ioLock);
    return noErr;
}

OSStatus WStudio_WillDoIOOperation(AudioServerPlugInDriverRef, AudioObjectID, UInt32,
                                   UInt32 op, Boolean* outWillDo, Boolean* outWillDoInPlace) {
    bool will = (op == kAudioServerPlugInIOOperationReadInput);
    *outWillDo = will;
    *outWillDoInPlace = true;
    return noErr;
}
OSStatus WStudio_BeginIOOperation(AudioServerPlugInDriverRef, AudioObjectID, UInt32, UInt32, void*, const AudioServerPlugInIOCycleInfo*)
    { return noErr; }
OSStatus WStudio_DoIOOperation(AudioServerPlugInDriverRef, AudioObjectID, AudioObjectID streamID,
                               UInt32, UInt32 op, const AudioServerPlugInIOCycleInfo*,
                               void* ioMainBuffer, void* /*ioSecondaryBuffer*/) {
    if (op != kAudioServerPlugInIOOperationReadInput) return noErr;
    if (streamID != kObjectID_Stream) return noErr;
    // The host requests the same number of frames as our zero-timestamp period
    // each cycle. Drain that many mono Float32 samples from shm.
    if (!gState->shm.isOpen()) gState->shm.open();
    gState->shm.read(static_cast<float*>(ioMainBuffer), kZeroTimeStampPeriod);
    gState->ioRunCount.fetch_add(1);
    return noErr;
}
OSStatus WStudio_EndIOOperation(AudioServerPlugInDriverRef, AudioObjectID, UInt32, UInt32, void*, const AudioServerPlugInIOCycleInfo*)
    { return noErr; }

// ─────────────────────────────────────────────────────────────────────────────
// COM plumbing
// ─────────────────────────────────────────────────────────────────────────────
static AudioServerPlugInDriverInterface gInterface = {
    nullptr,                                  // _reserved
    WStudio_QueryInterface,
    WStudio_AddRef,
    WStudio_Release,
    WStudio_Initialize,
    WStudio_CreateDevice,
    WStudio_DestroyDevice,
    WStudio_AddDeviceClient,
    WStudio_RemoveDeviceClient,
    WStudio_PerformDeviceConfigurationChange,
    WStudio_AbortDeviceConfigurationChange,
    WStudio_HasProperty,
    WStudio_IsPropertySettable,
    WStudio_GetPropertyDataSize,
    WStudio_GetPropertyData,
    WStudio_SetPropertyData,
    WStudio_StartIO,
    WStudio_StopIO,
    WStudio_GetZeroTimeStamp,
    WStudio_WillDoIOOperation,
    WStudio_BeginIOOperation,
    WStudio_DoIOOperation,
    WStudio_EndIOOperation,
};
static AudioServerPlugInDriverInterface* gInterfacePtr = &gInterface;

HRESULT WStudio_QueryInterface(void* /*drv*/, REFIID uuid, LPVOID* outIface) {
    if (outIface == nullptr) return E_POINTER;
    CFUUIDRef wanted = CFUUIDCreateFromUUIDBytes(nullptr, uuid);
    bool match = wanted &&
        (CFEqual(wanted, CFUUIDGetConstantUUIDWithBytes(nullptr,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46))   // IUnknown
         || CFEqual(wanted, kAudioServerPlugInDriverInterfaceUUID));
    if (wanted) CFRelease(wanted);
    if (!match) { *outIface = nullptr; return E_NOINTERFACE; }
    gRefCount.fetch_add(1);
    *outIface = &gInterfacePtr;
    return S_OK;
}
ULONG WStudio_AddRef(void*)  { return gRefCount.fetch_add(1) + 1; }
ULONG WStudio_Release(void*) {
    ULONG n = gRefCount.fetch_sub(1) - 1;
    return n;
}

} // namespace

// ─────────────────────────────────────────────────────────────────────────────
// Factory — referenced by Info.plist CFPlugInFactories.
// ─────────────────────────────────────────────────────────────────────────────
extern "C" void* WStudio_Create(CFAllocatorRef /*allocator*/, CFUUIDRef typeUUID) {
    // We only respond to the AudioServerPlugIn type request.
    if (typeUUID == nullptr || !CFEqual(typeUUID, kAudioServerPlugInTypeUUID)) {
        return nullptr;
    }
    if (gState == nullptr) {
        gState = new DriverState();
    }
    return &gInterfacePtr;
}
