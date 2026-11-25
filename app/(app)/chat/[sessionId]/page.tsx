import { notFound } from "next/navigation";
import ChatApp from "@/components/chat/ChatApp";

export const metadata = { title: "쏘웰라 | 쏠 웰니스 하우스" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 대화 하나의 주소: /chat/<대화 id>(대표님 2026-11-25). 본인 대화인지는 서버(/api/chat/sessions/<id>)가 확인한다.
export default async function ChatSession({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) notFound();
  return <ChatApp initialSessionId={sessionId} />;
}
