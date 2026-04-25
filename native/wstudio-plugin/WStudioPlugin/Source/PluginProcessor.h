#pragma once

#include <JuceHeader.h>
#include <atomic>

#include "Session/WStudioSessionTypes.h"

#include <memory>

class PluginNetworkAudio;

namespace WStudioParams
{
inline constexpr auto gainId = "gain";
inline constexpr auto muteId = "mute";
inline constexpr auto monitorId = "monitor";
inline constexpr auto inputGainId = "inputGain";
inline constexpr auto inputMuteId = "inputMute";
inline constexpr auto liveId = "live";
inline constexpr auto talkbackId = "talkback";
}

class WStudioPluginAudioProcessor : public juce::AudioProcessor
{
public:
    WStudioPluginAudioProcessor();
    ~WStudioPluginAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

#ifndef JucePlugin_PreferredChannelConfigurations
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
#endif

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getAPVTS() noexcept { return apvts; }

    /** Message thread only — mirrors session enum for lock-free audio reads. */
    void applySessionStateForAudioThread(SessionState s) noexcept;

    void setGain(float value);
    void setMuteEnabled(bool on);
    void setMonitorEnabled(bool on);
    /** Latched talkback (Engineer + session only — UI enforces). */
    void setTalkbackEnabled(bool on);
    void setInputGain(float value);
    void setInputMute(bool on);
    void setLiveSession(bool on);

    float getLeftLevel() const noexcept { return getInputPeakLeft(); }
    float getRightLevel() const noexcept { return getInputPeakRight(); }

    bool isMuteEnabled() const;
    bool isMonitorEnabled() const;
    bool isTalkbackEnabled() const;
    bool isInputMuted() const;

    /**
     * Phase 2 routing toggles (all APVTS-backed for host/preset sync):
     * outputMuted → muteId, micMuted → inputMuteId, monitorEnabled → monitorId, talkbackEnabled → talkbackId.
     */
    bool isOutputMuted() const { return isMuteEnabled(); }
    bool isMicMuted() const { return isInputMuted(); }

    float getInputPeakLeft() const noexcept { return inputPeakLeft.load(std::memory_order_relaxed); }
    float getInputPeakRight() const noexcept { return inputPeakRight.load(std::memory_order_relaxed); }

    /** Extra session blob saved beside APVTS (editor commits). */
    void commitSessionSnapshot(juce::ValueTree snapshot);
    juce::ValueTree copySessionSnapshot() const;

    /** Optional experimental path: loopback WebSocket PCM (off by default; see WSTUDIO_AU_ENABLE_NETWORK_BRIDGE). */
    void ensureNetworkBridgeServerRunning();

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    void measureAndSmoothPeaks(const juce::AudioBuffer<float>& buffer, int numChannels, int numSamples) noexcept;

    juce::AudioProcessorValueTreeState apvts;

    std::atomic<SessionState> sessionStateAudio { SessionState::Offline };
    std::atomic<float> inputPeakLeft { 0.f };
    std::atomic<float> inputPeakRight { 0.f };

    double sampleRate = 44100.0;
    int samplesPerBlock = 512;
    float meterReleasePerBlock = 0.9f;
    /** Smoothed 0…1 multiplier toward talkback duck target (message-thread-safe read not required). */
    float talkbackDuckSmoothed = 1.f;
    float talkbackDuckSmoothingCoeff = 0.15f;

    mutable juce::CriticalSection sessionSnapshotLock;
    juce::ValueTree sessionSnapshot { "WStudioSession" };

    std::unique_ptr<PluginNetworkAudio> networkAudio;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WStudioPluginAudioProcessor)
};
