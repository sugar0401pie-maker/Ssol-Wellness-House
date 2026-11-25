import ChatApp from "@/components/chat/ChatApp";

export const metadata = { title: "지난 대화 | 쏠 웰니스 하우스" };

// 지난 대화 목록 주소(대표님 2026-11-25 — 화면마다 주소)
export default function ChatHistory() {
  return <ChatApp openHistoryOnMount />;
}
