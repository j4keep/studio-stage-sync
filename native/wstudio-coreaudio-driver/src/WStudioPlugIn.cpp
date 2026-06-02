// W.STUDIO Virtual CoreAudio Driver (Phase 1 scaffold)
//
// AudioServerPlugIn entry points. This file is intentionally a skeleton:
// the full property-getter / IO-cycle implementation requires Apple's
// CoreAudio SDK headers and must be compiled on a Mac with Xcode.
//
// Reference:
//   https://developer.apple.com/library/archive/samplecode/AudioDriverExamples/
//   /System/Library/Frameworks/CoreAudio.framework/Headers/AudioServerPlugIn.h
//
// Device identity:
//   Name             : "W.STUDIO Artist Input"
//   Manufacturer     : "Wheuat"
//   UID              : "com.wheuat.wstudio.artist-input"
//   Streams          : 1 input
//   Format           : 48000 Hz, Float32, 1 channel
//
// IO loop:
//   On every IOCycle, BeginIOOperation(kAudioServerPlugInIOOperationReadInput)
//   drains up to (nFrames) samples from shm /wstudio_slot1 into the supplied
//   buffer. If the helper hasn't written enough, the gap is zero-filled
//   (the DAW records silence rather than glitching).

#include <CoreAudio/AudioServerPlugIn.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>

extern "C" void* WStudio_Create(CFAllocatorRef allocator, CFUUIDRef typeUUID);

static OSStatus WStudio_QueryInterface(void* inDriverRef, REFIID inInterfaceID, void** outInterface);
static ULONG WStudio_AddRef(void* inDriverRef);
static ULONG WStudio_Release(void* inDriverRef);
static OSStatus WStudio_Initialize(AudioServerPlugInDriverRef inDriver, AudioServerPlugInHostRef inHost);
static OSStatus WStudio_CreateDevice(AudioServerPlugInDriverRef inDriver, CFDictionaryRef inDescription, const AudioServerPlugInClientInfo* inClientInfo, AudioObjectID* outDeviceID);
static OSStatus WStudio_DestroyDevice(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID);
static OSStatus WStudio_HasProperty(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress);
static OSStatus WStudio_IsPropertySettable(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, Boolean* outSettable);
static OSStatus WStudio_GetPropertyDataSize(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32* outDataSize);
static OSStatus WStudio_GetPropertyData(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32 inDataSize, UInt32* outDataSize, void* outData);
static OSStatus WStudio_SetPropertyData(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32 inDataSize, const void* inData);
static OSStatus WStudio_StartIO(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID);
static OSStatus WStudio_StopIO(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID);
static OSStatus WStudio_GetZeroTimeStamp(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, Float64* outSampleTime, UInt64* outHostTime, UInt64* outSeed);
static OSStatus WStudio_WillDoIOOperation(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, UInt32 inOperationID, Boolean* outWillDo, Boolean* outWillDoInPlace);
static OSStatus WStudio_BeginIOOperation(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, UInt32 inOperationID, UInt32 inIOBufferFrameSize, AudioServerPlugInIOCycleInfo* ioCycleInfo);
static OSStatus WStudio_DoIOOperation(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, UInt32 inOperationID, UInt32 inIOBufferFrameSize, AudioServerPlugInIOCycleInfo* ioCycleInfo, void* ioData, void* clientData);
static OSStatus WStudio_EndIOOperation(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, UInt32 inOperationID, UInt32 inIOBufferFrameSize, AudioServerPlugInIOCycleInfo* ioCycleInfo);

static AudioServerPlugInDriverInterface gDriverInterface = {
    NULL,
    WStudio_QueryInterface,
    WStudio_AddRef,
    WStudio_Release,
    WStudio_Initialize,
    WStudio_CreateDevice,
    WStudio_DestroyDevice,
    NULL, // AddDeviceClient
    NULL, // RemoveDeviceClient
    NULL, // PerformDeviceConfigurationChange
    NULL, // AbortDeviceConfigurationChange
    WStudio_HasProperty,
    WStudio_IsPropertySettable,
    WStudio_GetPropertyDataSize,
    WStudio_GetPropertyData,
    WStudio_SetPropertyData,
    WStudio_StartIO,
    WStudio_StopIO,
    WStudio_GetZeroTimeStamp,
    NULL, // WillDoIOOperation
    NULL, // BeginIOOperation
    NULL, // DoIOOperation
    NULL  // EndIOOperation
};

void* WStudio_Create(CFAllocatorRef /*allocator*/, CFUUIDRef /*typeUUID*/) {
    static AudioServerPlugInDriverRef driverRef = &gDriverInterface;
    return &driverRef;
}

static OSStatus WStudio_QueryInterface(void* inDriverRef, REFIID inInterfaceID, void** outInterface) {
    if (CFEqual(inInterfaceID, kAudioServerPlugInDriverInterfaceUUID)) {
        *outInterface = inDriverRef;
        return kAudioNoError;
    }
    return kAudioErrUnsupportedOperation;
}

static ULONG WStudio_AddRef(void* inDriverRef) { return 1; }
static ULONG WStudio_Release(void* inDriverRef) { return 1; }
static OSStatus WStudio_Initialize(AudioServerPlugInDriverRef inDriver, AudioServerPlugInHostRef inHost) { return kAudioNoError; }
static OSStatus WStudio_CreateDevice(AudioServerPlugInDriverRef inDriver, CFDictionaryRef inDescription, const AudioServerPlugInClientInfo* inClientInfo, AudioObjectID* outDeviceID) { return kAudioNoError; }
static OSStatus WStudio_DestroyDevice(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID) { return kAudioNoError; }
static OSStatus WStudio_HasProperty(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress) { return kAudioErrUnsupportedOperation; }
static OSStatus WStudio_IsPropertySettable(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, Boolean* outSettable) { return kAudioErrUnsupportedOperation; }
static OSStatus WStudio_GetPropertyDataSize(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32* outDataSize) { return kAudioErrUnsupportedOperation; }
static OSStatus WStudio_GetPropertyData(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32 inDataSize, UInt32* outDataSize, void* outData) { return kAudioErrUnsupportedOperation; }
static OSStatus WStudio_SetPropertyData(AudioServerPlugInDriverRef inDriver, AudioObjectID inObjectID, pid_t inClientPID, const AudioObjectPropertyAddress* inAddress, UInt32 inQualifierDataSize, const void* inQualifierData, UInt32 inDataSize, const void* inData) { return kAudioErrUnsupportedOperation; }
static OSStatus WStudio_StartIO(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID) { return kAudioNoError; }
static OSStatus WStudio_StopIO(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID) { return kAudioNoError; }
static OSStatus WStudio_GetZeroTimeStamp(AudioServerPlugInDriverRef inDriver, AudioObjectID inDeviceID, UInt32 inClientID, Float64* outSampleTime, UInt64* outHostTime, UInt64* outSeed) { return kAudioNoError; }
