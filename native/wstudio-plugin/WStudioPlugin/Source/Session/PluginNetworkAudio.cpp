#include "PluginNetworkAudio.h"

#include <cstring>

namespace
{
static constexpr const char* kWsGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// RFC 4648 base64 (accept line for Sec-WebSocket-Accept).
static juce::String base64EncodeRaw(const void* data, size_t numBytes)
{
    static const char tbl[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const auto* bytes = static_cast<const uint8_t*>(data);
    juce::String s;

    size_t i = 0;
    while (i < numBytes)
    {
        const size_t chunkLen = juce::jmin((size_t)3, numBytes - i);
        uint32_t triple = 0;
        for (size_t j = 0; j < chunkLen; ++j)
            triple |= (uint32_t)bytes[i + j] << (int)(16 - (int)j * 8);
        i += chunkLen;

        s += tbl[(triple >> 18) & 63];
        s += tbl[(triple >> 12) & 63];
        if (chunkLen == 3)
        {
            s += tbl[(triple >> 6) & 63];
            s += tbl[triple & 63];
        }
        else if (chunkLen == 2)
        {
            s += tbl[(triple >> 6) & 63];
            s += '=';
        }
        else
        {
            s += '=';
            s += '=';
        }
    }
    return s;
}

// Minimal SHA-1 (public-domain style block transform).
struct Sha1
{
    uint32_t h[5] { 0x67452301u, 0xEFCDAB89u, 0x98BADCFEu, 0x10325476u, 0xC3D2E1F0u };
    uint64_t bitLength = 0;
    uint8_t block[64] {};
    int blockUsed = 0;

    static uint32_t rol(uint32_t x, int n) { return (x << n) | (x >> (32 - n)); }

    void processBlock(const uint8_t* chunk)
    {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i)
            w[i] = ((uint32_t)chunk[i * 4 + 0] << 24) | ((uint32_t)chunk[i * 4 + 1] << 16)
                   | ((uint32_t)chunk[i * 4 + 2] << 8) | ((uint32_t)chunk[i * 4 + 3]);

        for (int i = 16; i < 80; ++i)
            w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

        uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];

        for (int i = 0; i < 80; ++i)
        {
            uint32_t f, k;
            if (i < 20)
            {
                f = (b & c) | (~b & d);
                k = 0x5A827999u;
            }
            else if (i < 40)
            {
                f = b ^ c ^ d;
                k = 0x6ED9EBA1u;
            }
            else if (i < 60)
            {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8F1BBCDCu;
            }
            else
            {
                f = b ^ c ^ d;
                k = 0xCA62C1D6u;
            }

            const uint32_t temp = rol(a, 5) + f + e + k + w[i];
            e = d;
            d = c;
            c = rol(b, 30);
            b = a;
            a = temp;
        }

        h[0] += a;
        h[1] += b;
        h[2] += c;
        h[3] += d;
        h[4] += e;
    }

    void addBytes(const void* data, size_t len)
    {
        const auto* p = static_cast<const uint8_t*>(data);
        bitLength += (uint64_t)len * 8;

        while (len > 0)
        {
            const size_t space = (size_t)(64 - blockUsed);
            const size_t n = juce::jmin(len, space);
            memcpy(block + blockUsed, p, n);
            blockUsed += juce::roundToInt((double)n);
            p += n;
            len -= n;

            if (blockUsed == 64)
            {
                processBlock(block);
                blockUsed = 0;
            }
        }
    }

    void finish(uint8_t out20[20])
    {
        const uint64_t totalBits = bitLength;

        uint8_t pad[64];
        int padLen = 0;
        pad[padLen++] = 0x80;

        while ((blockUsed + padLen + 8) % 64 != 0)
            pad[padLen++] = 0;

        for (int i = 7; i >= 0; --i)
            pad[padLen++] = (uint8_t)((totalBits >> (i * 8)) & 0xFF);

        const uint8_t* p = pad;
        size_t len = (size_t)padLen;
        while (len > 0)
        {
            const size_t space = (size_t)(64 - blockUsed);
            const size_t n = juce::jmin(len, space);
            memcpy(block + blockUsed, p, n);
            blockUsed += juce::roundToInt((double)n);
            p += n;
            len -= n;

            if (blockUsed == 64)
            {
                processBlock(block);
                blockUsed = 0;
            }
        }

        for (int i = 0; i < 5; ++i)
        {
            out20[i * 4 + 0] = (uint8_t)((h[i] >> 24) & 0xFF);
            out20[i * 4 + 1] = (uint8_t)((h[i] >> 16) & 0xFF);
            out20[i * 4 + 2] = (uint8_t)((h[i] >> 8) & 0xFF);
            out20[i * 4 + 3] = (uint8_t)(h[i] & 0xFF);
        }
    }
};

static juce::String computeWebSocketAccept(const juce::String& clientKey)
{
    Sha1 sha;
    const juce::String in = clientKey.trim() + kWsGuid;
    sha.addBytes(in.toRawUTF8(), (size_t)in.getNumBytesAsUTF8());
    uint8_t digest[20];
    sha.finish(digest);
    return base64EncodeRaw(digest, 20);
}

static juce::String toLowerHeaderName(juce::String s)
{
    return s.toLowerCase();
}

static bool readHttpHeaders(juce::StreamingSocket& sock, juce::String& headersOut)
{
    headersOut.clear();
    char c;
    int state = 0; // 0 idle, 1 saw \r, 2 saw \r\n, 3 saw \r\n\r

    while (true)
    {
        const int n = sock.read(&c, 1, true);
        if (n <= 0)
            return false;

        headersOut += c;

        if (c == '\r')
        {
            if (state == 2)
                state = 3;
            else
                state = 1;
        }
        else if (c == '\n')
        {
            if (state == 1)
                state = 2;
            else if (state == 3)
                return true;
            else
                state = 0;
        }
        else
        {
            state = 0;
        }

        if (headersOut.length() > 65536)
            return false;
    }
}

static juce::String extractHeaderValue(const juce::String& headers, const juce::String& nameLower)
{
    const auto lines = juce::StringArray::fromLines(headers);
    for (const auto& line : lines)
    {
        const int colon = line.indexOfChar(':');
        if (colon <= 0)
            continue;

        auto key = line.substring(0, colon).trim();
        if (toLowerHeaderName(key) == nameLower)
            return line.substring(colon + 1).trim();
    }
    return {};
}

static bool sendAll(juce::StreamingSocket& sock, const void* data, int len)
{
    const auto* p = static_cast<const char*>(data);
    int remaining = len;
    while (remaining > 0)
    {
        const int w = sock.write(p, remaining);
        if (w <= 0)
            return false;
        p += w;
        remaining -= w;
    }
    return true;
}

static void pushStereoPcm(PluginNetworkAudio* self, juce::AbstractFifo& fifo, juce::HeapBlock<float>& storage,
                          const float* samples, int numStereoFrames) noexcept;

} // namespace

PluginNetworkAudio::PluginNetworkAudio()
    : Thread("WStudio network audio")
{
    fifoStorage.malloc((size_t)fifo.getTotalSize());
}

PluginNetworkAudio::~PluginNetworkAudio()
{
    stopServer();
}

void PluginNetworkAudio::startServer(int port)
{
    if (isThreadRunning() && serverRunning.load(std::memory_order_acquire) && listenPort == port)
    {
        DBG("PluginNetworkAudio: already listening on 127.0.0.1:" << port << " (startServer no-op)");
        return;
    }

    stopServer();
    listenPort = port;
    serverRunning.store(true, std::memory_order_release);
    DBG("PluginNetworkAudio: starting bridge listen thread for 127.0.0.1:" << port);
    startThread(juce::Thread::Priority::normal);
}

void PluginNetworkAudio::stopServer()
{
    serverRunning.store(false, std::memory_order_release);

    {
        const juce::ScopedLock sl(clientLock);
        if (client != nullptr)
            client->close();
        client.reset();
    }

    if (listener != nullptr)
        listener->close();
    listener.reset();

    stopThread(4000);
}

void PluginNetworkAudio::setMaxAudioBlockSize(int maxSamples) noexcept
{
    if (maxSamples <= 0)
        return;
    // Headroom: some hosts briefly exceed prepareToPlay's block hint; never RT-allocate in pullAndAdd.
    const int frames = juce::jmax(maxSamples, 4096);
    const int needFloats = frames * 2;
    if (pullScratchFloats < needFloats)
    {
        pullScratch.malloc((size_t)needFloats);
        pullScratchFloats = needFloats;
    }
}

void PluginNetworkAudio::pullAndAdd(juce::AudioBuffer<float>& buffer, int numChannels, int numSamples) noexcept
{
    if (numSamples <= 0 || numChannels <= 0 || fifoStorage.get() == nullptr)
        return;

    const size_t ready = fifo.getNumReady();
    const size_t maxRead = (size_t) juce::jmax(0, numSamples);
    const size_t chunk = juce::jmin(maxRead, ready);
    const int toRead = juce::roundToInt((double)chunk);
    if (toRead <= 0)
        return;

    const int needFloats = toRead * 2;
    if (pullScratch.get() == nullptr || needFloats > pullScratchFloats)
        return;

    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    fifo.prepareToRead(toRead, start1, size1, start2, size2);

    float* dst = pullScratch.get();
    if (size1 > 0)
        memcpy(dst, fifoStorage.get() + (size_t)start1 * 2, (size_t)size1 * sizeof(float) * 2);
    if (size2 > 0)
        memcpy(dst + (size_t)size1 * 2, fifoStorage.get() + (size_t)start2 * 2, (size_t)size2 * sizeof(float) * 2);

    fifo.finishedRead(size1 + size2);

    auto* l = buffer.getWritePointer(0);
    auto* r = numChannels > 1 ? buffer.getWritePointer(1) : l;

    for (int i = 0; i < toRead; ++i)
    {
        const float sl = dst[(size_t)i * 2];
        const float sr = dst[(size_t)i * 2 + 1];
        l[i] += sl;
        if (numChannels > 1)
            r[i] += sr;
    }
}

void PluginNetworkAudio::run()
{
    listener = std::make_unique<juce::StreamingSocket>();
    if (!listener->createListener(listenPort, "127.0.0.1"))
    {
        DBG("PluginNetworkAudio: FAILED createListener on 127.0.0.1:" << listenPort
                                                                      << " (port in use or bind error?)");
        listener.reset();
        return;
    }

    DBG("PluginNetworkAudio: listening for WebSocket on 127.0.0.1:" << listenPort);

    while (!threadShouldExit() && serverRunning.load(std::memory_order_acquire))
    {
        std::unique_ptr<juce::StreamingSocket> conn(listener->waitForNextConnection());
        if (conn == nullptr || threadShouldExit())
            break;

        juce::String headers;
        if (!readHttpHeaders(*conn, headers))
            continue;

        const auto key = extractHeaderValue(headers, "sec-websocket-key");
        if (key.isEmpty())
            continue;

        const auto accept = computeWebSocketAccept(key);
        juce::String response;
        response << "HTTP/1.1 101 Switching Protocols\r\n"
                 << "Upgrade: websocket\r\n"
                 << "Connection: Upgrade\r\n"
                 << "Sec-WebSocket-Accept: " << accept << "\r\n"
                 << "\r\n";

        if (!sendAll(*conn, response.toRawUTF8(),
                     juce::roundToInt((double)response.getNumBytesAsUTF8())))
            continue;

        {
            const juce::ScopedLock sl(clientLock);
            client = std::move(conn);
        }

        auto& sock = *client;

        while (!threadShouldExit() && serverRunning.load(std::memory_order_acquire))
        {
            uint8_t hdr[2];
            if (sock.read(hdr, 2, true) != 2)
                break;

            const bool fin = (hdr[0] & 0x80) != 0;
            juce::ignoreUnused(fin);
            const int opcode = hdr[0] & 0x0F;
            if (opcode == 0x8)
                break; // close
            if (opcode == 0x9)
            {
                // ping — skip payload
            }

            uint64_t payloadLen = hdr[1] & 0x7F;
            const bool masked = (hdr[1] & 0x80) != 0;
            if (payloadLen == 126)
            {
                uint8_t e[2];
                if (sock.read(e, 2, true) != 2)
                    break;
                payloadLen = ((uint64_t)e[0] << 8) | (uint64_t)e[1];
            }
            else if (payloadLen == 127)
            {
                uint8_t e[8];
                if (sock.read(e, 8, true) != 8)
                    break;
                payloadLen = 0;
                for (int i = 0; i < 8; ++i)
                    payloadLen = (payloadLen << 8) | e[i];
            }

            uint8_t mask[4] {};
            if (masked)
            {
                if (sock.read(mask, 4, true) != 4)
                    break;
            }

            if (payloadLen > (uint64_t)64 * 1024 * 1024)
                break;

            if (payloadLen > 0 && (size_t)payloadLen > wsPayloadScratchBytes)
            {
                wsPayloadScratch.malloc((size_t)payloadLen);
                wsPayloadScratchBytes = (size_t)payloadLen;
            }

            uint8_t* payload = payloadLen > 0 ? wsPayloadScratch.get() : nullptr;
            if (payloadLen > 0 && sock.read(payload, (int)payloadLen, true) != (int)payloadLen)
                break;

            if (masked && payload != nullptr)
            {
                for (uint64_t i = 0; i < payloadLen; ++i)
                    payload[i] = (uint8_t)(payload[i] ^ mask[i & 3]);
            }

            if (opcode == 0x2 || opcode == 0x0 || opcode == 0x1)
            {
                // Binary/text: treat binary as float32 stereo interleaved.
                if (opcode == 0x2 && payloadLen >= 8 && (payloadLen % 8) == 0 && payload != nullptr)
                {
                    const int frames = (int)(payloadLen / 8);
                    static int rxLogCounter = 0;
                    if ((++rxLogCounter % 64) == 0)
                        DBG("W.STUDIO received WebSocket audio bytes: " << (int)payloadLen << " (" << frames
                                                                          << " stereo frames float32 LE)");
                    pushStereoPcm(this, fifo, fifoStorage, (const float*)payload, frames);
                }
            }
        }

        {
            const juce::ScopedLock sl(clientLock);
            client.reset();
        }
    }

    listener.reset();
}

namespace
{
static void pushStereoPcm(PluginNetworkAudio*, juce::AbstractFifo& fifo, juce::HeapBlock<float>& storage,
                          const float* samples, int numStereoFrames) noexcept
{
    if (numStereoFrames <= 0)
        return;

    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    fifo.prepareToWrite(numStereoFrames, start1, size1, start2, size2);

    const int wrote = size1 + size2;
    if (wrote <= 0)
        return;

    int inFrame = 0;
    if (size1 > 0)
    {
        memcpy(storage.get() + (size_t)start1 * 2, samples, (size_t)size1 * sizeof(float) * 2);
        inFrame += size1;
    }
    if (size2 > 0)
    {
        memcpy(storage.get() + (size_t)start2 * 2, samples + (size_t)inFrame * 2, (size_t)size2 * sizeof(float) * 2);
    }

    fifo.finishedWrite(wrote);
}
} // namespace
