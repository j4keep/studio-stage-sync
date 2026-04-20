#pragma once

#include "WStudioSessionTypes.h"
#include <JuceHeader.h>
#include <vector>

/**
 * GET session-lookup Edge Function (Supabase) — run from a worker thread, not audio.
 * Response shape matches Lovable / live_sessions + live_session_participants.
 */
struct SessionLookupParseResult
{
    bool ok = false;
    juce::String error;
    juce::String sessionUuid;
    juce::String sessionCode;
    juce::String sessionStatus;

    std::vector<SessionParticipant> participants;

    /** Parse body only (tests / reuse). */
    static SessionLookupParseResult parseJson(const juce::String& json);

    /** Blocking HTTP GET + parse. */
    static SessionLookupParseResult fetch(const juce::String& sessionCode, const juce::String& bearerToken);
};
