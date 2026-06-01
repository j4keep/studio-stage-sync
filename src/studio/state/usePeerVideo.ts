// WebRTC peer for the /studio V2 prototype.
// Signaling runs over Supabase Realtime so engineer + artist on DIFFERENT
// devices (phone, laptop, different browsers) can actually connect.
// Engineer is the "offerer", Artist the "answerer".

import { useEffect, useRef, useState } from "react";
import {
  sendRtcSignal,
  subscribeRtcSignals,
  type RtcSignalPayload,
} from "@/wstudio/media/realtimeRtcSignaling";

export type PeerRole = "engineer" | "artist";

export function useStudioPeerVideo(
  sessionId: string | undefined,
  role: PeerRole,
  localStream: MediaStream | null,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<RTCPeerConnectionState>("new");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoTxRef = useRef<RTCRtpTransceiver | null>(null);
  const audioTxRef = useRef<RTCRtpTransceiver | null>(null);
  const makingOfferRef = useRef(false);
  const peerReadyRef = useRef(false);
  const connStateRef = useRef<RTCPeerConnectionState>("new");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    // Pre-declare bidirectional media so SDP negotiates send+recv from start.
    videoTxRef.current = pc.addTransceiver("video", { direction: "sendrecv" });
    audioTxRef.current = pc.addTransceiver("audio", { direction: "sendrecv" });

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (e) => {
      const t = e.track;
      if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
      setRemoteStream(new MediaStream(remote.getTracks()));
      // eslint-disable-next-line no-console
      console.log("[/studio] PEER_TRACK", role, t.kind);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendRtcSignal(sessionId, {
          t: "ice",
          candidate: e.candidate.toJSON(),
          from: role,
        });
      }
    };
    pc.onconnectionstatechange = () => {
      connStateRef.current = pc.connectionState;
      setConnState(pc.connectionState);
      // eslint-disable-next-line no-console
      console.log("[/studio] PEER_STATE", role, pc.connectionState);
    };

    const flushIce = async () => {
      if (!pc.remoteDescription || pendingIceRef.current.length === 0) return;
      const queued = pendingIceRef.current.splice(0);
      for (const candidate of queued) {
        try { await pc.addIceCandidate(candidate); } catch {}
      }
    };

    const makeOffer = async () => {
      if (makingOfferRef.current) return;
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendRtcSignal(sessionId, { t: "offer", sdp: offer.sdp ?? "", from: role });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[/studio] OFFER_ERROR", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    const onSignal = async (data: RtcSignalPayload) => {
      if (!data || data.from === role) return;
      try {
        if (data.t === "ready") {
          peerReadyRef.current = true;
          if (role === "engineer") {
            await makeOffer();
          } else {
            // Let the engineer know we're here too.
            sendRtcSignal(sessionId, { t: "ready", from: role });
          }
        } else if (data.t === "offer" && role === "artist") {
          await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendRtcSignal(sessionId, { t: "answer", sdp: answer.sdp ?? "", from: role });
        } else if (data.t === "answer" && role === "engineer") {
          if (pc.signalingState === "have-local-offer" || !pc.currentRemoteDescription) {
            await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            await flushIce();
          }
        } else if (data.t === "ice") {
          if (!pc.remoteDescription) {
            pendingIceRef.current.push(data.candidate);
          } else {
            try { await pc.addIceCandidate(data.candidate); } catch {}
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[/studio] SIGNAL_ERROR", err);
      }
    };

    const unsubscribe = subscribeRtcSignals(sessionId, onSignal);
    // Announce presence; the other side will reply with "ready" or an offer.
    sendRtcSignal(sessionId, { t: "ready", from: role });
    // Re-announce a moment later in case the peer subscribes after we did.
    const announceTimer = window.setTimeout(() => {
      if (!peerReadyRef.current) {
        sendRtcSignal(sessionId, { t: "ready", from: role });
      }
    }, 800);
    const reconnectTimer = window.setInterval(() => {
      const state = connStateRef.current;
      if (state === "connected" || state === "closed") return;
      sendRtcSignal(sessionId, { t: "ready", from: role });
      if (role === "engineer" && pc.signalingState === "stable") {
        void makeOffer();
      }
    }, 2500);

    return () => {
      window.clearTimeout(announceTimer);
      window.clearInterval(reconnectTimer);
      unsubscribe();
      pc.close();
      pcRef.current = null;
      videoTxRef.current = null;
      audioTxRef.current = null;
      peerReadyRef.current = false;
      pendingIceRef.current = [];
      connStateRef.current = "closed";
      setRemoteStream(null);
      setConnState("closed");
    };
  }, [sessionId, role]);

  // Replace outgoing tracks whenever local stream changes.
  useEffect(() => {
    const v = videoTxRef.current?.sender;
    const a = audioTxRef.current?.sender;
    const vt = localStream?.getVideoTracks()[0] ?? null;
    const at = localStream?.getAudioTracks()[0] ?? null;
    v?.replaceTrack(vt).catch(() => {});
    a?.replaceTrack(at).catch(() => {});
  }, [localStream]);

  return { remoteStream, connState };
}
