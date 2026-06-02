#include "HelperClient.h"

HelperClient::HelperClient() : juce::Thread("WStudio HelperClient") {}

HelperClient::~HelperClient() { stopAndJoin(); }

void HelperClient::start()
{
    if (!isThreadRunning())
    {
        running = true;
        startThread();
    }
}

void HelperClient::stopAndJoin()
{
    running = false;
    if (isThreadRunning())
        stopThread(1000);
}

HelperClient::Status HelperClient::getStatus() const noexcept
{
    const juce::ScopedLock sl(statusLock);
    return latest;
}

static juce::String varToCompactJson(const juce::var& v)
{
    return juce::JSON::toString(v, true);
}

void HelperClient::postJson(const juce::String& path, const juce::var& body)
{
    const juce::String url = juce::String(kBaseUrl) + path;
    const juce::String json = varToCompactJson(body);

    juce::URL u(url);
    u = u.withPOSTData(json);

    auto opts = juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inPostData)
                    .withConnectionTimeoutMs(1000)
                    .withExtraHeaders("Content-Type: application/json\r\n")
                    .withHttpRequestCmd("POST");

    int statusCode = 0;
    juce::StringPairArray responseHeaders;
    if (auto stream = u.createInputStream(opts, &statusCode, &responseHeaders))
    {
        stream->readEntireStreamAsString();
    }
}

void HelperClient::sendControlEvent(const juce::String& controlId,
                                    float floatValue,
                                    bool  boolValue)
{
    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty("type", "PLUGIN_STATE");
    obj->setProperty("slot", 1);
    obj->setProperty("control", controlId);
    obj->setProperty("value_f", floatValue);
    obj->setProperty("value_b", boolValue);
    obj->setProperty("trackName", "W.STUDIO AU");

    if (controlId == "gain")           cachedGain    = floatValue;
    else if (controlId == "mute")      cachedMute    = boolValue;
    else if (controlId == "monitor")   cachedMonitor = boolValue;
    else if (controlId == "talkback")  cachedTalk    = boolValue;
    else if (controlId == "inputGain") cachedMicGain = floatValue;
    else if (controlId == "inputMute") cachedMicMute = boolValue;
    else if (controlId == "live")      cachedLive    = boolValue;

    auto var = juce::var(obj.get());
    juce::Thread::launch([this, var]() { postJson("/plugin-event", var); });
}

void HelperClient::sendFullState(float gain, bool mute, bool monitor, bool talkback,
                                 float micGain, bool micMute, bool live)
{
    cachedGain = gain; cachedMute = mute; cachedMonitor = monitor;
    cachedTalk = talkback; cachedMicGain = micGain; cachedMicMute = micMute;
    cachedLive = live;

    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty("type", "PLUGIN_STATE");
    obj->setProperty("slot", 1);
    obj->setProperty("trackName", "W.STUDIO AU");
    obj->setProperty("gain", gain);
    obj->setProperty("mute", mute);
    obj->setProperty("monitor", monitor);
    obj->setProperty("talkback", talkback);
    obj->setProperty("inputGain", micGain);
    obj->setProperty("inputMute", micMute);
    obj->setProperty("live", live);

    auto var = juce::var(obj.get());
    juce::Thread::launch([this, var]() { postJson("/plugin-event", var); });
}

void HelperClient::pollStatusOnce()
{
    juce::URL u(juce::String(kBaseUrl) + "/status");
    auto opts = juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
                    .withConnectionTimeoutMs(800)
                    .withHttpRequestCmd("GET");

    int statusCode = 0;
    juce::StringPairArray responseHeaders;
    auto stream = u.createInputStream(opts, &statusCode, &responseHeaders);

    Status next;
    if (stream != nullptr && statusCode >= 200 && statusCode < 300)
    {
        const auto body = stream->readEntireStreamAsString();
        const auto parsed = juce::JSON::parse(body);
        if (parsed.isObject())
        {
            next.helperReachable = true;
            next.deviceInstalled = (bool) parsed.getProperty("device_installed", false);
            const auto slot = parsed.getProperty("slot_1", juce::var());
            if (slot.isObject())
            {
                next.slotConnected = (bool) slot.getProperty("connected", false);
                next.slotLevel = (float) (double) slot.getProperty("level", 0.0);
                next.packets = (juce::uint64) (juce::int64) slot.getProperty("packets", 0);
                next.failed  = (juce::uint64) (juce::int64) slot.getProperty("failed", 0);
            }
        }
    }

    {
        const juce::ScopedLock sl(statusLock);
        latest = next;
    }

    auto cb = statusListener;
    if (cb)
    {
        juce::MessageManager::callAsync([cb, next]() { cb(next); });
    }
}

void HelperClient::run()
{
    {
        juce::DynamicObject::Ptr hello = new juce::DynamicObject();
        hello->setProperty("type", "PLUGIN_HELLO");
        hello->setProperty("slot", 1);
        hello->setProperty("trackName", "W.STUDIO AU");
        postJson("/plugin-event", juce::var(hello.get()));
    }

    int tick = 0;
    while (running.load() && !threadShouldExit())
    {
        pollStatusOnce();

        if ((tick % 4) == 0)
        {
            juce::DynamicObject::Ptr obj = new juce::DynamicObject();
            obj->setProperty("type", "PLUGIN_STATE");
            obj->setProperty("slot", 1);
            obj->setProperty("trackName", "W.STUDIO AU");
            obj->setProperty("gain", (float)    cachedGain.load());
            obj->setProperty("mute", (bool)     cachedMute.load());
            obj->setProperty("monitor", (bool)  cachedMonitor.load());
            obj->setProperty("talkback", (bool) cachedTalk.load());
            obj->setProperty("inputGain", (float) cachedMicGain.load());
            obj->setProperty("inputMute", (bool)  cachedMicMute.load());
            obj->setProperty("live", (bool)       cachedLive.load());
            postJson("/plugin-event", juce::var(obj.get()));
        }

        ++tick;
        wait(500);
    }
}
