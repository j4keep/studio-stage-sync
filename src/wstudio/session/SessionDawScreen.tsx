import { useSession } from "./SessionContext";
import WStudioDawPage from "@/pages/WStudioDawPage";

/**
 * Live session route: drops collaborators directly into the DAW with the
 * shared session code from SessionContext.
 */
export default function SessionDawScreen() {
  const { sessionId } = useSession();
  return <WStudioDawPage sessionCode={sessionId || undefined} />;
}
