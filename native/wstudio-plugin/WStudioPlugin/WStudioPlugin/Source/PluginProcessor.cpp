#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "Session/AudioRouter.h"
#include "Session/PluginNetworkAudio.h"
#include <cmath>

namespace
{
static constexpr const char* kRootStateId = "WSTPersistRoot";
/** Loopback WebSocket port for W.STUDIO web → plugin bridge audio (must match web). */
static constexpr int kPluginNetworkAudioPort = 47999;
}

WStudioPluginAudioProcessor::WStudioPluginAudioProcessor()
    : AudioProcessor(BusesProperties()
#if !JucePlugin_IsMidiEffect
#if !JucePlugin_IsSynth
                         .withInput("Input", juce::AudioChannelSet::stereo(), true)
#endif
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)
#endif
                         ),
      apvts(*this, nullptr, "PARAMS", createParameterLayout())
{
}

WStudioPluginAudioProcessor::~WStudioPluginAudioProcessor() = default;

juce::AudioProcessorValueTreeState::ParameterLayout WStudioPluginAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        WStudioParams::gainId, "Gain", juce::NormalisableRange<float>(0.0f, 1.5f, 0.001f, 0.5f), 1.0f));
    params.push_back(
        std::make_unique<juce::AudioParameterBool>(WStudioParams::muteId, "Mute", false));
    params.push_back(
        std::make_unique<juce::AudioParameterBool>(WStudioParams::monitorId, "Monitor", true));
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        WStudioParams::inputGainId, "Mic gain", juce::NormalisableRange<float>(0.0f, 2.0f, 0.001f, 0.5f), 1.0f));
    params.push_back(
        std::make_unique<juce::AudioParameterBool>(WStudioParams::inputMuteId, "Mic mute", false));
    params.push_back(
        std::make_unique<juce::AudioParameterBool>(WStudioParams::liveId, "Live session", false));
    params.push_back(
        std::make_unique<juce::AudioParameterBool>(WStudioParams::talkbackId, "Talkback", false));
    return {params.begin(), params.end()};
}

void WStudioPluginAudioProcessor::applySessionStateForAudioThread(SessionState s) noexcept
{
    sessionStateAudio.store(s, std::memory_order_release);
}

void WStudioPluginAudioProcessor::commitSessionSnapshot(juce::ValueTree snapshot)
{
    const juce::ScopedLock sl(sessionSnapshotLock);
    sessionSnapshot = std::move(snapshot);
}

juce::ValueTree WStudioPluginAudioProcessor::copySessionSnapshot() const
{
    const juce::ScopedLock sl(sessionSnapshotLock);
    return sessionSnapshot.createCopy();
}

void WStudioPluginAudioProcessor::setGain(float value)
{
    value = juce::jlimit(0.0f, 1.5f, value);
    if (auto* p = apvts.getParameter(WStudioParams::gainId))
        p->setValueNotifyingHost(apvts.getParameterRange(WStudioParams::gainId).convertTo0to1(value));
}

void WStudioPluginAudioProcessor::setMuteEnabled(bool on)
{
    if (auto* p = apvts.getParameter(WStudioParams::muteId))
        p->setValueNotifyingHost(on ? 1.f : 0.f);
}

void WStudioPluginAudioProcessor::setMonitorEnabled(bool on)
{
    if (auto* p = apvts.getParameter(WStudioParams::monitorId))
        p->setValueNotifyingHost(on ? 1.f : 0.f);
}

void WStudioPluginAudioProcessor::setTalkbackEnabled(bool on)
{
    if (auto* p = apvts.getParameter(WStudioParams::talkbackId))
        p->setValueNotifyingHost(on ? 1.f : 0.f);
}

void WStudioPluginAudioProcessor::setInputGain(float value)
{
    value = juce::jlimit(0.0f, 2.0f, value);
    if (auto* p = apvts.getParameter(WStudioParams::inputGainId))
        p->setValueNotifyingHost(apvts.getParameterRange(WStudioParams::inputGainId).convertTo0to1(value));
}

void WStudioPluginAudioProcessor::setInputMute(bool on)
{
    if (auto* p = apvts.getParameter(WStudioParams::inputMuteId))
        p->setValueNotifyingHost(on ? 1.f : 0.f);
}

void WStudioPluginAudioProcessor::setLiveSession(bool on)
{
    if (auto* p = apvts.getParameter(WStudioParams::liveId))
        p->setValueNotifyingHost(on ? 1.f : 0.f);
}

bool WStudioPluginAudioProcessor::isMuteEnabled() const
{
    return apvts.getRawParameterValue(WStudioParams::muteId) != nullptr
           && apvts.getRawParameterValue(WStudioParams::muteId)->load() > 0.5f;
}

bool WStudioPluginAudioProcessor::isMonitorEnabled() const
{
    return apvts.getRawParameterValue(WStudioParams::monitorId) != nullptr
           && apvts.getRawParameterValue(WStudioParams::monitorId)->load() > 0.5f;
}

bool WStudioPluginAudioProcessor::isInputMuted() const
{
    return apvts.getRawParameterValue(WStudioParams::inputMuteId) != nullptr
           && apvts.getRawParameterValue(WStudioParams::inputMuteId)->load() > 0.5f;
}

bool WStudioPluginAudioProcessor::isTalkbackEnabled() const
{
    return apvts.getRawParameterValue(WStudioParams::talkbackId) != nullptr
           && apvts.getRawParameterValue(WStudioParams::talkbackId)->load() > 0.5f;
}

const juce::String WStudioPluginAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool WStudioPluginAudioProcessor::acceptsMidi() const
{
#if JucePlugin_WantsMidiInput
    return true;
#else
    return false;
#endif
}

bool WStudioPluginAudioProcessor::producesMidi() const
{
#if JucePlugin_ProducesMidiOutput
    return true;
#else
    return false;
#endif
}

bool WStudioPluginAudioProcessor::isMidiEffect() const
{
#if JucePlugin_IsMidiEffect
    return true;
#else
    return false;
#endif
}

double WStudioPluginAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int WStudioPluginAudioProcessor::getNumPrograms()
{
    return 1;
}

int WStudioPluginAudioProcessor::getCurrentProgram()
{
    return 0;
}

void WStudioPluginAudioProcessor::setCurrentProgram(int)
{
}

const juce::String WStudioPluginAudioProcessor::getProgramName(int)
{
    return {};
}

void WStudioPluginAudioProcessor::changeProgramName(int, const juce::String&)
{
}

void WStudioPluginAudioProcessor::prepareToPlay(double newSampleRate, int newSamplesPerBlock)
{
    if (networkAudio == nullptr)
        networkAudio = std::make_unique<PluginNetworkAudio>();
    networkAudio->startServer(kPluginNetworkAudioPort);

    sampleRate = newSampleRate;
    samplesPerBlock = juce::jmax(1, newSamplesPerBlock);
    constexpr double tauSec = 0.22;
    meterReleasePerBlock =
        (float)std::exp(-(double)samplesPerBlock / (sampleRate * tauSec));
    // ~50 ms smoothing for talkback duck / unduck (studio-style cue dim).
    constexpr double duckTauSec = 0.05;
    talkbackDuckSmoothingCoeff =
        1.f - (float)std::exp(-(double)samplesPerBlock / (sampleRate * duckTauSec));
    talkbackDuckSmoothed = 1.f;
}

void WStudioPluginAudioProcessor::releaseResources()
{
    if (networkAudio != nullptr)
        networkAudio->stopServer();
}

#ifndef JucePlugin_PreferredChannelConfigurations
bool WStudioPluginAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
#if JucePlugin_IsMidiEffect
    juce::ignoreUnused(layouts);
    return true;
#else
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

#if !JucePlugin_IsSynth
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
#endif

    return true;
#endif
}
#endif

void WStudioPluginAudioProcessor::measureAndSmoothPeaks(const juce::AudioBuffer<float>& buffer, int numChannels,
                                                        int numSamples) noexcept
{
    float bl = 0.f;
    float br = 0.f;
    AudioRouter::measurePeaks(buffer, numChannels, numSamples, bl, br);

    const float prevL = inputPeakLeft.load(std::memory_order_relaxed);
    const float prevR = inputPeakRight.load(std::memory_order_relaxed);
    inputPeakLeft.store(juce::jmax(bl, prevL * meterReleasePerBlock), std::memory_order_relaxed);
    inputPeakRight.store(juce::jmax(br, prevR * meterReleasePerBlock), std::memory_order_relaxed);
}

void WStudioPluginAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ignoreUnused(midi);
    juce::ScopedNoDenormals noDenormals;

    const int nCh = buffer.getNumChannels();
    const int nSm = buffer.getNumSamples();

    measureAndSmoothPeaks(buffer, nCh, nSm);

    const auto st = sessionStateAudio.load(std::memory_order_acquire);
    const bool sessionActive = (st == SessionState::Connected || st == SessionState::Live || st == SessionState::Recording);

    float gain = 1.0f;
    if (auto* p = apvts.getRawParameterValue(WStudioParams::gainId))
        gain = p->load();

    float inGain = 1.0f;
    if (auto* p = apvts.getRawParameterValue(WStudioParams::inputGainId))
        inGain = p->load();

    const bool outputMute =
        apvts.getRawParameterValue(WStudioParams::muteId) != nullptr
        && apvts.getRawParameterValue(WStudioParams::muteId)->load() > 0.5f;

    const bool monitoring =
        apvts.getRawParameterValue(WStudioParams::monitorId) != nullptr
        && apvts.getRawParameterValue(WStudioParams::monitorId)->load() > 0.5f;

    const bool micSendMuted =
        apvts.getRawParameterValue(WStudioParams::inputMuteId) != nullptr
        && apvts.getRawParameterValue(WStudioParams::inputMuteId)->load() > 0.5f;

    const bool talkbackOn =
        apvts.getRawParameterValue(WStudioParams::talkbackId) != nullptr
        && apvts.getRawParameterValue(WStudioParams::talkbackId)->load() > 0.5f;

    // Dim the program like a real cue mix when talkback is latched and session is up (voice over music).
    constexpr float kTalkbackDuckedLevel = 0.12f;
    const float duckTarget = (talkbackOn && sessionActive) ? kTalkbackDuckedLevel : 1.f;
    talkbackDuckSmoothed += talkbackDuckSmoothingCoeff * (duckTarget - talkbackDuckSmoothed);

    AudioRouter::MainBusCoeffs c;
    c.masterGain = gain;
    c.inputGain = inGain;
    c.outputMute = outputMute;
    c.monitorDim = !monitoring;
    c.micSendMuted = micSendMuted;
    c.sessionActive = sessionActive;
    c.talkbackMusicGain = talkbackDuckSmoothed;

    AudioRouter::processMainInsert(buffer, nCh, nSm, c);

    if (networkAudio != nullptr)
        networkAudio->pullAndAdd(buffer, nCh, nSm);
}

bool WStudioPluginAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* WStudioPluginAudioProcessor::createEditor()
{
    return new WStudioPluginAudioProcessorEditor(*this);
}

void WStudioPluginAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::ValueTree root(kRootStateId);
    root.appendChild(apvts.copyState(), nullptr);
    {
        const juce::ScopedLock sl(sessionSnapshotLock);
        if (sessionSnapshot.isValid())
            root.appendChild(sessionSnapshot.createCopy(), nullptr);
    }
    juce::MemoryOutputStream mos(destData, false);
    root.writeToStream(mos);
}

void WStudioPluginAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream mis(data, (size_t)sizeInBytes, false);
    auto root = juce::ValueTree::readFromStream(mis);
    if (!root.isValid() || !root.hasType(kRootStateId))
        return;

    if (auto params = root.getChildWithName(apvts.state.getType()); params.isValid())
        apvts.replaceState(params);

    for (int i = 0; i < root.getNumChildren(); ++i)
    {
        auto ch = root.getChild(i);
        if (ch.hasType("WStudioSession"))
        {
            const juce::ScopedLock sl(sessionSnapshotLock);
            sessionSnapshot = ch.createCopy();
            break;
        }
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new WStudioPluginAudioProcessor();
}
