#pragma once

#include <JuceHeader.h>
#include <atomic>
#include <functional>

/**
 * HelperClient — talks to the W.STUDIO Helper App on http://127.0.0.1:48000.
 *
 * Responsibilities (Phase 1, AU = control surface only):
 *   - POST /plugin-event on every control change (LIVE / RECEIVE / SEND /
 *     TALK / MUTE / GAIN / MIC_GAIN / MIC_MUTE / MONITOR). Body is small JSON.
 *   - Periodically POST a PLUGIN_HELLO / PLUGIN_STATE so the helper marks the
 *     plugin "connected" and the web UI's "Plugin connected" badge stays lit.
 *   - Poll GET /status every ~500ms to drive the plugin meters from the real
 *     helper-side slot level (the artist audio that's actually being recorded
 *     into the virtual CoreAudio device), instead of fake or stale values.
 *
 * All network I/O runs on a dedicated background thread. The audio thread
 * never blocks on HTTP.
 */
class HelperClient : private juce::Thread
{
public:
    /** Latest /status snapshot polled from the helper. */
    struct Status {
        bool helperReachable = false;
        bool deviceInstalled = false;
        bool slotConnected = false;
        float slotLevel = 0.f;
        juce::uint64 packets = 0;
        juce::uint64 failed = 0;
    };

    using StatusListener = std::function<void(const Status&)>;

    HelperClient();
    ~HelperClient() override;

    /** Begin background polling + keepalive. Safe to call multiple times. */
    void start();
    /** Stop background thread. Called from destructor. */
    void stopAndJoin();

    /** Fire-and-forget control event. Safe to call from any non-audio thread. */
    void sendControlEvent(const juce::String& controlId,
                          float floatValue,
                          bool  boolValue);

    /** Snapshot the entire control surface as a single PLUGIN_STATE message. */
    void sendFullState(float gain, bool mute, bool monitor, bool talkback,
                       float micGain, bool micMute, bool live);

    Status getStatus() const noexcept;

    /** Called on the message thread after each successful /status poll. */
    void onStatus(StatusListener cb) { statusListener = std::move(cb); }

private:
    void run() override;
    void pollStatusOnce();
    void postJson(const juce::String& path, const juce::var& body);

    static constexpr const char* kBaseUrl = "http://127.0.0.1:48000";

    std::atomic<bool> running { false };
    mutable juce::CriticalSection statusLock;
    Status latest;
    StatusListener statusListener;

    // Cached snapshot for keepalive PLUGIN_STATE messages.
    std::atomic<float> cachedGain { 1.f };
    std::atomic<float> cachedMicGain { 1.f };
    std::atomic<bool>  cachedMute { false };
    std::atomic<bool>  cachedMicMute { false };
    std::atomic<bool>  cachedMonitor { true };
    std::atomic<bool>  cachedTalk { false };
    std::atomic<bool>  cachedLive { false };
};
