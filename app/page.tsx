import AccessGate from "@/components/chat/AccessGate";
import ChatApp from "@/components/chat/ChatApp";

export default function Home() {
  return (
    <AccessGate>
      <ChatApp />
    </AccessGate>
  );
}
