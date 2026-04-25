#pragma once

#include <JuceHeader.h>
#include <cstdint>

/** High-level session lifecycle (UI + session layer). Audio thread reads a mirrored atomic copy. */
enum class SessionState : int
{
    Offline = 0,
    Connecting,
    Connected,
    Live,
    Recording,
    Error
};

/** Plugin operating mode — engineer hosts; artist joins an existing host session. */
enum class UserRole : int
{
    Engineer = 0,
    Artist
};

/** Network / signalling phase placeholder until WebRTC or sockets land. */
enum class ConnectionPhase : int
{
    Idle = 0,
    Resolving,
    Handshaking,
    Ready,
    Failed
};

/** One participant (engineer or artist). Designed for 10+ entries; UI may show a subset. */
struct SessionParticipant
{
    juce::String id;
    juce::String displayName;
    UserRole role = UserRole::Artist;
    bool connected = false;
    bool muted = false;
    bool ready = false;
    float audioLevel = 0.f;
    bool isActiveSpeaker = false;
    bool recordingEnabled = false;
};

inline juce::String sessionStateDisplayName(SessionState s)
{
    switch (s)
    {
        case SessionState::Offline:
            return "OFFLINE";
        case SessionState::Connecting:
            return "CONNECTING";
        case SessionState::Connected:
            return "CONNECTED";
        case SessionState::Live:
            return "LIVE";
        case SessionState::Recording:
            return "RECORDING";
        case SessionState::Error:
            return "ERROR";
    }
    return {};
}

inline juce::String userRoleDisplayName(UserRole r)
{
    return r == UserRole::Engineer ? juce::String("Engineer") : juce::String("Artist");
}
