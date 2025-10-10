import { useUserStore } from '@/stores/userStore';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { InitUser } from '@/components/InitUser';
import { Dashboard } from '@/components/Dashboard';
import { CallRoom } from '@/components/CallRoom';
import { IncomingCall } from '@/components/IncomingCall';
import OutgoingCall from '@/components/OutgoingCall';
import { Toaster } from 'sonner';

function App() {
  const isInitialized = useUserStore((state) => state.isInitialized);
  const currentRoom = useVoiceChatStore((state) => state.currentRoom);

  // Manage socket connection at app level - persists across view changes
  useSocketConnection();

  // Show InitUser if not initialized
  if (!isInitialized) {
    return (
      <>
        <InitUser />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show CallRoom if in a room
  if (currentRoom) {
    return (
      <>
        <CallRoom />
        <IncomingCall />
        <OutgoingCall />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show Dashboard by default
  return (
    <>
      <Dashboard />
      <IncomingCall />
      <OutgoingCall />
      <Toaster position="top-center" richColors />
    </>
  );
}

export default App;
