#pragma once

#include "WStudioSessionTypes.h"
#include <algorithm>
#include <vector>

/**
 * Session data owned on the message / UI thread.
 * Audio thread must NOT read this directly — mirror only what you need via atomics in the processor.
 */
class SessionModel
{
public:
    static constexpr int maxParticipants = 32;

    SessionModel() { participants.reserve(16); }

    void clearParticipants()
    {
        const juce::ScopedLock sl(lock);
        participants.clear();
    }

    void setSessionId(juce::String sid)
    {
        const juce::ScopedLock sl(lock);
        sessionId = std::move(sid);
    }

    juce::String getSessionId() const
    {
        const juce::ScopedLock sl(lock);
        return sessionId;
    }

    void setHostParticipantId(juce::String id)
    {
        const juce::ScopedLock sl(lock);
        hostParticipantId = std::move(id);
    }

    void upsertParticipant(SessionParticipant p)
    {
        const juce::ScopedLock sl(lock);
        for (auto& existing : participants)
        {
            if (existing.id == p.id)
            {
                existing = std::move(p);
                return;
            }
        }
        if (participants.size() < (size_t)maxParticipants)
            participants.push_back(std::move(p));
    }

    void removeParticipant(const juce::String& pid)
    {
        const juce::ScopedLock sl(lock);
        participants.erase(
            std::remove_if(participants.begin(), participants.end(),
                           [&](const SessionParticipant& p) { return p.id == pid; }),
            participants.end());
    }

    int getConnectedParticipantCount() const
    {
        const juce::ScopedLock sl(lock);
        int n = 0;
        for (const auto& p : participants)
            if (p.connected)
                ++n;
        return n;
    }

    std::vector<SessionParticipant> copyParticipants() const
    {
        const juce::ScopedLock sl(lock);
        return participants;
    }

    void setMockAggregateArtistLevel(float level)
    {
        mockAggregateArtistLevel = juce::jlimit(0.f, 1.f, level);
    }

    float getMockAggregateArtistLevel() const { return mockAggregateArtistLevel; }

private:
    mutable juce::CriticalSection lock;
    juce::String sessionId;
    juce::String hostParticipantId;
    std::vector<SessionParticipant> participants;
    float mockAggregateArtistLevel = 0.f;
};
