// 마이페이지 "고객의 의견" 폼의 분류 목록(2026-10-01 owner 지정). 브라우저(폼)와
// 서버(검증) 양쪽에서 쓰므로 "server-only"는 넣지 않는다.

export type FeedbackCategoryId = "web_error" | "payment_error" | "service_suggestion" | "other";

export const FEEDBACK_CATEGORIES: { id: FeedbackCategoryId; label: string }[] = [
  { id: "web_error", label: "웹페이지 오류" },
  { id: "payment_error", label: "결제 오류" },
  { id: "service_suggestion", label: "서비스 관련 제안" },
  { id: "other", label: "기타" },
];
