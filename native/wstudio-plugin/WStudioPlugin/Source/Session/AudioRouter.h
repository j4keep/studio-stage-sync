#pragma once

#include <JuceHeader.h>

/**
 * Single place to document and apply bus routing math.
 * Real-time safe: all inputs are plain floats/bools copied at block start — no locks, no allocations.
 *
 * Future: separate buffers for talkback bus, artist return bus, playback send, etc.
 * Today: one stereo I/O path with explicit gain staging (DAW insert style).
 */
class AudioRouter
{
public:
    struct MainBusCoeffs
    {
        float masterGain = 1.f;
        float inputGain = 1.f;
        bool outputMute = false;
        bool monitorDim = false;
        bool micSendMuted = false;
        /** When false, session is not "live" — optional future duck or mute of send path. */
        bool sessionActive = false;
        float monitorScalarWhenDimmed = 0.25f;
        /**
         * Studio talkback: multiply program/cue level (0…1). Smoothed on the processor before each block.
         * ~0.12 ≈ −18 dB dim — room for voice over the track.
         */
        float talkbackMusicGain = 1.f;
    };

    /** Peak measurement before any gain — for metering UI. */
    static void measurePeaks(const juce::AudioBuffer<float>& buffer, int numChannels, int numSamples, float& outL,
                           float& outR) noexcept;

    /** Apply staging: session path is placeholder; structure maps to future multi-bus graph. */
    static void processMainInsert(juce::AudioBuffer<float>& buffer, int numChannels, int numSamples,
 MainBusCoeffs c) noexcept;

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioRouter)
};
