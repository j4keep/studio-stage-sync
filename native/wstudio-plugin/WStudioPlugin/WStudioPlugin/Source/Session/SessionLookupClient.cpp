#include "SessionLookupClient.h"

namespace
{
constexpr const char* kSessionLookupUrl = WSTUDIO_SESSION_LOOKUP_URL;

inline SessionLookupParseResult fail(juce::String msg)
{
    SessionLookupParseResult r;
    r.ok = false;
    r.error = std::move(msg);
    return r;
}

inline bool jsonKeyIsNonEmptyString(const juce::var& v)
{
    return v.isString() && v.toString().trim().isNotEmpty();
}

inline UserRole roleFromApiString(const juce::String& s)
{
    if (s.compareIgnoreCase("engineer") == 0)
        return UserRole::Engineer;
    return UserRole::Artist;
}

inline SessionParticipant participantFromVar(const juce::var& item, juce::String& errOut)
{
    SessionParticipant p;
    auto* o = item.getDynamicObject();
    if (o == nullptr)
    {
        errOut = "Invalid participant entry";
        return p;
    }

    p.id = o->getProperty("id").toString();
    if (p.id.isEmpty())
    {
        errOut = "Participant missing id";
        return p;
    }

    p.displayName = o->getProperty("display_name").toString();
    if (p.displayName.isEmpty())
        p.displayName = "(unknown)";

    p.role = roleFromApiString(o->getProperty("role").toString());

    const bool micMuted = (bool)o->getProperty("mic_muted");
    const bool isLive = (bool)o->getProperty("is_live");

    const juce::var leftAt = o->getProperty("left_at");
    const bool hasLeft = jsonKeyIsNonEmptyString(leftAt);

    p.muted = micMuted;
    p.connected = isLive && !hasLeft;
    p.ready = p.connected;
    p.audioLevel = 0.f;
    p.isActiveSpeaker = false;
    p.recordingEnabled = false;

    errOut.clear();
    return p;
}
} // namespace

SessionLookupParseResult SessionLookupParseResult::parseJson(const juce::String& json)
{
    if (json.trim().isEmpty())
        return fail("Empty response");

    const juce::var root = juce::JSON::parse(json);
    auto* rootObj = root.getDynamicObject();
    if (rootObj == nullptr)
        return fail("Invalid JSON");

    const juce::var sessionVar = rootObj->getProperty("session");
    auto* sessionObj = sessionVar.getDynamicObject();
    if (sessionObj == nullptr)
        return fail("Missing session object");

    SessionLookupParseResult r;
    r.sessionUuid = sessionObj->getProperty("id").toString();
    r.sessionCode = sessionObj->getProperty("session_code").toString();
    r.sessionStatus = sessionObj->getProperty("status").toString();

    if (r.sessionCode.isEmpty() && r.sessionUuid.isEmpty())
        return fail("Session missing id/code");

    const juce::var partsVar = rootObj->getProperty("participants");
    if (!partsVar.isArray())
        return fail("Missing participants array");

    const auto* arr = partsVar.getArray();
    if (arr == nullptr)
        return fail("Invalid participants array");

    const int cap = juce::jmin(arr->size(), 64);
    r.participants.reserve((size_t)cap);

    for (const auto& item : *arr)
    {
        juce::String perr;
        SessionParticipant p = participantFromVar(item, perr);
        if (perr.isNotEmpty())
            return fail(perr);
        r.participants.push_back(std::move(p));
    }

    r.ok = true;
    return r;
}

SessionLookupParseResult SessionLookupParseResult::fetch(const juce::String& sessionCode,
                                                         const juce::String& bearerToken)
{
    const juce::String code = sessionCode.trim();
    const juce::String token = bearerToken.trim();

    if (code.isEmpty())
        return fail("Session code is empty");
    if (token.isEmpty())
        return fail("Access token is empty");

    juce::URL url { juce::String(kSessionLookupUrl) };
    url = url.withParameter("code", code);

    const juce::String headers = "Authorization: Bearer " + token + "\r\n";

    auto opts = juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
                    .withConnectionTimeoutMs(20000)
                    .withExtraHeaders(headers);

    const std::unique_ptr<juce::InputStream> stream(url.createInputStream(opts));
    if (stream == nullptr)
        return fail("Could not connect (check network, code, or token)");

    const juce::String body = stream->readEntireStreamAsString();
    auto parsed = parseJson(body);
    if (!parsed.ok)
    {
        if (parsed.error.isEmpty())
            parsed.error = "Could not parse response";
        return parsed;
    }

    return parsed;
}
