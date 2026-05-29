// Minimal WebRTC peer for the /studio V2 prototype.
// Signaling over BroadcastChannel so two tabs in the same browser
// (engineer + artist) can exchange video/audio with no backend.
// Engineer is the "offerer", Artist the "answerer".

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
  const videoTxRef = useRef<RTCRtpTransceiver | null>(null);
  const audioTxRef = useRef<RTCRtpTransceiver | null>(null);
  const peerReadyRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;
    const chan = new BroadcastChannel(sigChannel(sessionId));
    chanRef.current = chan;

    // Pre-declare bidirectional media so SDP negotiates send+recv from the start.
    videoTxRef.current = pc.addTransceiver("video", { direction: "sendrecv" });
    audioTxRef.current = pc.addTransceiver("audio", { direction: "sendrecv" });

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (e) => {
      const t = e.track;
      if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) chan.postMessage({ from: role, type: "ice", candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => setConnState(pc.connectionState);

    const makeOffer = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        chan.postMessage({ from: role, type: "offer", sdp: offer });
      } catch {}
    };

    const onMsg = async (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.from === role) return;
      try {
        if (data.type === "hello") {
          peerReadyRef.current = true;
          if (role === "engineer") {
            await makeOffer();
          } else {
            // Artist: reply so engineer (which may have mounted first and
            // already broadcast its hello) knows we're here and creates an offer.
            chan.postMessage({ from: role, type: "hello-ack" });
          }
        } else if (data.type === "hello-ack" && role === "engineer") {
          peerReadyRef.current = true;
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
        }
      } catch {}
    };
    chan.addEventListener("message", onMsg);
    chan.postMessage({ from: role, type: "hello" });


    return () => {
      chan.removeEventListener("message", onMsg);
      chan.close();
      pc.close();
      pcRef.current = null;
      chanRef.current = null;
      videoTxRef.current = null;
      audioTxRef.current = null;
      peerReadyRef.current = false;
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
