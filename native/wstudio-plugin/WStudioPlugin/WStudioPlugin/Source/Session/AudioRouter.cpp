#include "AudioRouter.h"
#include <cmath>

void AudioRouter::measurePeaks(const juce::AudioBuffer<float>& buffer, int numChannels, int numSamples, float& outL,
                               float& outR) noexcept
{
    outL = outR = 0.f;
    if (numSamples <= 0)
        return;
    if (numChannels > 0)
    {
        auto* p0 = buffer.getReadPointer(0);
        for (int i = 0; i < numSamples; ++i)
            outL = juce::jmax(outL, std::abs(p0[i]));
    }
    if (numChannels > 1)
    {
        auto* p1 = buffer.getReadPointer(1);
        for (int i = 0; i < numSamples; ++i)
            outR = juce::jmax(outR, std::abs(p1[i]));
    }
    else
        outR = outL;
}

void AudioRouter::processMainInsert(juce::AudioBuffer<float>& buffer, int numChannels, int numSamples,
                                    MainBusCoeffs c) noexcept
{
    if (c.outputMute)
    {
        buffer.clear();
        return;
    }

    const float mon = c.monitorDim ? c.monitorScalarWhenDimmed : 1.f;
    const float g = c.masterGain * c.inputGain * mon * c.talkbackMusicGain;
    // Note: micSendMuted reserved for when a separate "send tap" buffer exists (WebRTC uplink).

    juce::ignoreUnused(c.micSendMuted);

    for (int ch = 0; ch < numChannels; ++ch)
    {
        auto* d = buffer.getWritePointer(ch);
        for (int i = 0; i < numSamples; ++i)
            d[i] *= g;
    }
}
