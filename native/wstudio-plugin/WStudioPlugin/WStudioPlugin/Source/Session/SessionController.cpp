#include "SessionController.h"
#include "../PluginProcessor.h"
#include <thread>

SessionController::SessionController(WStudioPluginAudioProcessor& p) : processor(p) {}

void SessionController::setSessionState(SessionState next)
{
    sessionState = next;
    processor.applySessionStateForAudioThread(next);

    const bool liveParam = (next == SessionState::Live || next == SessionState::Recording);
    processor.setLiveSession(liveParam);

    if (next == SessionState::Offline || next == SessionState::Error)
    {
        remoteSnapshotValid = false;
        remotePollTickCounter = 0;
        model.clearParticipants();
        model.setSessionId({});
        connectionPhase = ConnectionPhase::Idle;
        mockTickCounter = 0;
    }
}

void SessionController::mockBeginConnecting()
{
    connectionPhase = ConnectionPhase::Handshaking;
    model.setSessionId(juce::Uuid().toString().substring(0, 8).toUpperCase());
    mockTickCounter = 0;
}

void SessionController::mockFinishConnecting()
{
    connectionPhase = ConnectionPhase::Ready;
    mockSimulateParticipants();
}

void SessionController::mockSimulateParticipants()
{
    model.clearParticipants();
    SessionParticipant host;
    host.id = "host";
    host.displayName = role == UserRole::Engineer ? "You (Engineer)" : "Host";
    host.role = UserRole::Engineer;
    host.connected = true;
    host.ready = true;
    model.upsertParticipant(std::move(host));

    const int nArtists = 2 + (mockTickCounter % 4);
    for (int i = 0; i < nArtists; ++i)
    {
        SessionParticipant a;
        a.id = "artist_" + juce::String(i + 1);
        a.displayName = "Artist " + juce::String(i + 1);
        a.role = UserRole::Artist;
        a.connected = true;
        a.ready = (i == 0);
        a.audioLevel = 0.1f * (float)(i + 1);
        model.upsertParticipant(std::move(a));
    }
}

float SessionController::pseudoNoise(int frame) const
{
    const float x = (float)frame * 0.017f;
    return 0.5f + 0.5f * std::sin(x) * std::sin(x * 1.7f);
}

void SessionController::applyRemoteLookupResult(const SessionLookupParseResult& r)
{
    model.clearParticipants();
    model.setSessionId(r.sessionCode.isNotEmpty() ? r.sessionCode : r.sessionUuid);
    for (const auto& p : r.participants)
        model.upsertParticipant(p);
}

void SessionController::tickRemotePoll()
{
    if (!remoteSnapshotValid)
        return;
    if (remoteSessionCode.isEmpty() || remoteAccessToken.isEmpty())
        return;
    if (!(sessionState == SessionState::Connected || sessionState == SessionState::Live
          || sessionState == SessionState::Recording))
        return;
    if (sessionLookupInFlight.load(std::memory_order_acquire))
        return;

    ++remotePollTickCounter;
    if (remotePollTickCounter < remotePollIntervalTicks)
        return;
    remotePollTickCounter = 0;

    fetchRemoteSession(remoteSessionCode, remoteAccessToken, {});
}

void SessionController::fetchRemoteSession(juce::String sessionCode, juce::String bearerToken,
                                         std::function<void(bool ok, juce::String error)> onComplete)
{
    const int gen = ++fetchGeneration;
    sessionLookupInFlight.store(true, std::memory_order_release);

    std::thread([this, sessionCode = std::move(sessionCode), bearerToken = std::move(bearerToken), gen,
                 onComplete = std::move(onComplete)]() mutable {
        SessionLookupParseResult result = SessionLookupParseResult::fetch(sessionCode, bearerToken);

        juce::MessageManager::callAsync([this, result = std::move(result), gen,
                                         sessionCode = std::move(sessionCode),
                                         bearerToken = std::move(bearerToken),
                                         onComplete = std::move(onComplete)]() mutable {
            if (gen != fetchGeneration.load(std::memory_order_acquire))
                return;

            sessionLookupInFlight.store(false, std::memory_order_release);

            if (!result.ok)
            {
                remoteSnapshotValid = false;
                if (onComplete)
                    onComplete(false, result.error);
                return;
            }

            applyRemoteLookupResult(result);
            remoteSessionCode = sessionCode;
            remoteAccessToken = bearerToken;
            remoteSnapshotValid = true;
            remotePollTickCounter = 0;

            const auto st = sessionState;
            if (st == SessionState::Offline || st == SessionState::Connecting || st == SessionState::Error)
            {
                mockTickCounter = 0;
                connectionPhase = ConnectionPhase::Ready;
                setSessionState(SessionState::Connected);
            }

            if (onComplete)
                onComplete(true, {});
        });
    }).detach();
}

void SessionController::tick()
{
    if (sessionState == SessionState::Connecting)
    {
        ++mockTickCounter;
        model.setMockAggregateArtistLevel(pseudoNoise(mockTickCounter));

        if (mockTickCounter >= mockConnectingDurationTicks)
        {
            mockFinishConnecting();
            setSessionState(SessionState::Connected);
        }
        return;
    }

    if (sessionState == SessionState::Connected || sessionState == SessionState::Live
        || sessionState == SessionState::Recording)
    {
        ++mockTickCounter;
        auto parts = model.copyParticipants();
        int i = 0;
        for (auto& p : parts)
        {
            if (p.role == UserRole::Artist && p.connected)
            {
                p.audioLevel = 0.15f + 0.55f * pseudoNoise(mockTickCounter + i * 13);
                p.isActiveSpeaker = p.audioLevel > 0.45f;
                model.upsertParticipant(p);
            }
            ++i;
        }
        float agg = 0.f;
        for (const auto& p : model.copyParticipants())
            if (p.role == UserRole::Artist && p.connected)
                agg = juce::jmax(agg, p.audioLevel);
        model.setMockAggregateArtistLevel(agg);
    }

    tickRemotePoll();
}

void SessionController::onLiveRegionClicked()
{
    switch (sessionState)
    {
        case SessionState::Offline:
            setSessionState(SessionState::Connecting);
            mockBeginConnecting();
            break;
        case SessionState::Connecting:
            setSessionState(SessionState::Offline);
            break;
        case SessionState::Connected:
            setSessionState(SessionState::Live);
            recordingArmed = false;
            break;
        case SessionState::Live:
            setSessionState(SessionState::Offline);
            break;
        case SessionState::Recording:
            setSessionState(SessionState::Live);
            recordingArmed = false;
            break;
        case SessionState::Error:
            setSessionState(SessionState::Offline);
            break;
    }
}

juce::String SessionController::getHeaderStatusText() const
{
    return sessionStateDisplayName(sessionState);
}

juce::String SessionController::getHeaderSessionLine() const
{
    const int n = model.getConnectedParticipantCount();
    juce::String roleTxt = userRoleDisplayName(role);
    juce::String sid = model.getSessionId();
    if (sid.isEmpty())
        return roleTxt + " - " + juce::String(n) + " in session";
    return roleTxt + " | " + sid + " | " + juce::String(n) + " connected";
}

juce::String SessionController::getLivePrimaryText() const
{
    if (role == UserRole::Engineer && sessionState == SessionState::Offline)
        return "LIVE";
    if (role == UserRole::Artist && sessionState == SessionState::Offline)
        return "JOIN";
    return "LIVE";
}

juce::String SessionController::getLiveSecondaryText() const
{
    switch (sessionState)
    {
        case SessionState::Offline:
            return role == UserRole::Engineer ? "HOST SESSION" : "JOIN SESSION";
        case SessionState::Connecting:
            return "CONNECTING...";
        case SessionState::Connected:
            return "SESSION READY";
        case SessionState::Live:
            return recordingArmed ? "RECORDING" : "SESSION ACTIVE";
        case SessionState::Recording:
            return "RECORDING";
        case SessionState::Error:
            return "DISCONNECTED";
    }
    return {};
}

bool SessionController::isTalkbackAllowed() const noexcept
{
    return role == UserRole::Engineer
           && (sessionState == SessionState::Connected || sessionState == SessionState::Live
               || sessionState == SessionState::Recording);
}

bool SessionController::shouldGlowLiveOrb() const noexcept
{
    return sessionState == SessionState::Live || sessionState == SessionState::Recording
           || sessionState == SessionState::Connecting;
}

juce::ValueTree SessionController::toValueTree() const
{
    juce::ValueTree v("WStudioSession");
    v.setProperty("role", (int)role, nullptr);
    v.setProperty("sessionState", (int)sessionState, nullptr);
    v.setProperty("sessionId", model.getSessionId(), nullptr);
    return v;
}

void SessionController::fromValueTree(const juce::ValueTree& v)
{
    if (!v.isValid() || !v.hasType("WStudioSession"))
        return;
    role = (UserRole)(int)v.getProperty("role", (int)UserRole::Engineer);
    sessionState = (SessionState)(int)v.getProperty("sessionState", (int)SessionState::Offline);
    model.setSessionId(v.getProperty("sessionId").toString());
    processor.applySessionStateForAudioThread(sessionState);
    const bool liveParam =
        (sessionState == SessionState::Live || sessionState == SessionState::Recording);
    processor.setLiveSession(liveParam);
}
