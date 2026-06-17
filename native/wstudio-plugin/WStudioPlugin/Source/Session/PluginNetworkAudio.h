#pragma once

#include <JuceHeader.h>

/**
 * Listens on loopback for a WebSocket carrying stereo interleaved float32 PCM (little-endian).
 * Intended for the W.STUDIO web app to push bridge audio into the plugin without a virtual cable.
 */
class PluginNetworkAudio final : private juce::Thread
{
public:
    PluginNetworkAudio();
    ~PluginNetworkAudio() override;

    void startServer(int port);
    void stopServer();

    /** Audio thread: pull up to numSamples stereo frames and add into buffer (stereo or mono). */
    void pullAndAdd(juce::AudioBuffer<float>& buffer, int numChannels, int numSamples) noexcept;

    /** Call from prepareToPlay only (not real-time). Sizes internal scratch so pullAndAdd never allocates. */
    void setMaxAudioBlockSize(int maxSamples) noexcept;

private:
    void run() override;

    juce::CriticalSection clientLock;
    std::unique_ptr<juce::StreamingSocket> client;

    std::unique_ptr<juce::StreamingSocket> listener;

    juce::AbstractFifo fifo { 1 << 18 }; // stereo floats ~ 128k frames
    juce::HeapBlock<float> fifoStorage;

    /** Stereo-interleaved pull staging; allocated on message thread in setMaxAudioBlockSize. */
    juce::HeapBlock<float> pullScratch;
    int pullScratchFloats = 0; // capacity in floats (L,R pairs => frames * 2)

    juce::HeapBlock<uint8_t> wsPayloadScratch;
    size_t wsPayloadScratchBytes = 0;

    std::atomic<bool> serverRunning { false };
    int listenPort = 47999;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginNetworkAudio)
};
