// Minimal WebRTC peer for the /studio V2 prototype.
// Uses BroadcastChannel as the signaling transport so two tabs in the same
// browser (engineer + artist) can exchange video/audio with no backend.
// Engineer is the "offerer", Artist is the "answerer".

import { useEffect, useRef, useState } from "react";

export type PeerRole = "engineer" | "artist";

const sigChannel = (sid: string) => `studio-v2-peer-${sid}`;

export function useStudioPeerVideo(
  sessionId: string | undefined,
  role: PeerRole,
  localStream: MediaStream | null,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<RTCPeerConnectionState>("new");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chanRef = useRef<BroadcastChannel | null>(null);
  const sendersRef = useRef<RTCRtpSender[]>([]);

  // Setup peer connection + signaling for this session.
  useEffect(() => {
    if (!sessionId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;
    const chan = new BroadcastChannel(sigChannel(sessionId));
    chanRef.current = chan;

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
      });
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        chan.postMessage({ from: role, type: "ice", candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => setConnState(pc.connectionState);

    const makeOffer = async () => {
      try {
        const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        chan.postMessage({ from: role, type: "offer", sdp: offer });
      } catch {}
    };

    const onMsg = async (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.from === role) return;
      try {
        if (data.type === "hello" && role === "engineer") {
          await makeOffer();
        } else if (data.type === "offer" && role === "artist") {
          await pc.setRemoteDescription(data.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          chan.postMessage({ from: role, type: "answer", sdp: answer });
        } else if (data.type === "answer" && role === "engineer") {
          if (!pc.currentRemoteDescription) await pc.setRemoteDescription(data.sdp);
        } else if (data.type === "ice") {
          try { await pc.addIceCandidate(data.candidate); } catch {}
        } else if (data.type === "bye") {
          // peer left; ignore — next hello will renegotiate
        }
      } catch {}
    };
    chan.addEventListener("message", onMsg);

    // Announce presence; artist waits for offer, engineer offers on hello.
    chan.postMessage({ from: role, type: "hello" });

    return () => {
      try { chan.postMessage({ from: role, type: "bye" }); } catch {}
      chan.removeEventListener("message", onMsg);
      chan.close();
      pc.getSenders().forEach((s) => { try { pc.removeTrack(s); } catch {} });
      pc.close();
      pcRef.current = null;
      chanRef.current = null;
      sendersRef.current = [];
      setRemoteStream(null);
      setConnState("closed");
    };
  }, [sessionId, role]);

  // Attach/replace local tracks whenever the local stream changes.
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc) return;
    // Remove old senders
    sendersRef.current.forEach((s) => { try { pc.removeTrack(s); } catch {} });
    sendersRef.current = [];
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        try { sendersRef.current.push(pc.addTrack(t, localStream)); } catch {}
      });
      // Engineer renegotiates after adding tracks.
      if (pc.signalingState === "stable" && chanRef.current) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            chanRef.current?.postMessage({ from: "engineer-renego", type: "offer", sdp: offer });
          } catch {}
        })();
      }
    }
  }, [localStream]);

  return { remoteStream, connState };
}
