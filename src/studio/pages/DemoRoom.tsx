import { useEffect } from "react";
import { useStudio } from "../state/StudioContext";
import EngineerRoom from "./EngineerRoom";

export default function DemoRoom() {
  const { createSession, session, setPlugin, setArtist, setHqAudio, toggleCheck, sendMessage, addFile } = useStudio();
  useEffect(() => {
    if (!session) {
      createSession({ name: "Demo Session", artistName: "Sasha", type: "Vocal Recording", engineerName: "Engineer" });
    }
    setPlugin("connected");
    setArtist("ready");
    setHqAudio("live");
    toggleCheck("artistMic", true);
    toggleCheck("artistHeadphones", true);
    toggleCheck("artistHearsBeat", true);
    toggleCheck("pluginConnected", true);
    sendMessage("Sasha", "I can hear the beat 🔥");
    sendMessage("Engineer", "Great. Take it from the top whenever you're ready.");
    addFile({ name: "reference_mix.wav", size: 8_400_000, type: "audio/wav", uploadedBy: "Engineer" });
    addFile({ name: "lyrics_v3.pdf", size: 124_000, type: "application/pdf", uploadedBy: "Sasha" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <EngineerRoom />;
}
