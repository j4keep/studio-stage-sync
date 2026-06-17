#pragma once

#include "SessionLookupClient.h"
#include "SessionModel.h"
#include <atomic>
#include <functional>

class WStudioPluginAudioProcessor;

/**
 * Message-thread session orchestration: state machine, mock signalling, participant bookkeeping.
 * Editor calls this; it notifies the processor via applySessionStateToAudioThread() for RT-safe flags.
 */
class SessionController
{
public:
    explicit SessionController(WStudioPluginAudioProcessor& processor);

    void setUserRole(UserRole r) { role = r; }
    UserRole getUserRole() const noexcept { return role; }

    SessionState getSessionState() const noexcept { return sessionState; }

    /** LIVE region tap — advances the state machine (mock until real network is wired). */
    void onLiveRegionClicked();

    /** Call from editor Timer (~15–30 Hz): mock connection progress, wandering meter levels. */
    void tick();

    juce::String getHeaderStatusText() const;
    juce::String getHeaderSessionLine() const;
    juce::String getLivePrimaryText() const;
    juce::String getLiveSecondaryText() const;

    bool isTalkbackAllowed() const noexcept;
    bool shouldGlowLiveOrb() const noexcept;

    SessionModel& getModel() noexcept { return model; }
    const SessionModel& getModel() const noexcept { return model; }

    /** Persist / restore hook — extend with session id, invites, etc. */
    juce::ValueTree toValueTree() const;
    void fromValueTree(const juce::ValueTree& v);

    /**
     * Pull session + participants from Supabase session-lookup (background thread + message-thread callback).
     * On success while Offline / Connecting / Error, advances to Connected. Token is kept in memory only.
     */
    void fetchRemoteSession(juce::String sessionCode, juce::String bearerToken,
                            std::function<void(bool ok, juce::String error)> onComplete = {});

    bool isRemoteSnapshotValid() const noexcept { return remoteSnapshotValid; }
    bool isSessionLookupInFlight() const noexcept { return sessionLookupInFlight.load(std::memory_order_acquire); }

    juce::String getLastRemoteSessionCode() const { return remoteSessionCode; }

private:
    void setSessionState(SessionState next);
    void mockBeginConnecting();
    void mockFinishConnecting();
    void mockSimulateParticipants();
    float pseudoNoise(int frame) const;

    void applyRemoteLookupResult(const SessionLookupParseResult& r);
    void tickRemotePoll();

    WStudioPluginAudioProcessor& processor;
    SessionModel model;
    UserRole role = UserRole::Engineer;
    SessionState sessionState = SessionState::Offline;
    ConnectionPhase connectionPhase = ConnectionPhase::Idle;

    int mockTickCounter = 0;
    int mockConnectingDurationTicks = 50;
    bool recordingArmed = false;

    juce::String remoteSessionCode;
    juce::String remoteAccessToken;
    bool remoteSnapshotValid = false;
    int remotePollTickCounter = 0;
    static constexpr int remotePollIntervalTicks = 48; // ~2s at 24 Hz UI timer

    std::atomic<int> fetchGeneration { 0 };
    std::atomic<bool> sessionLookupInFlight { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SessionController)
};
