// 온보딩 질문의 선택지를 wellness_practices의 domain/category 값으로 매핑한다.
// I/O가 없는 순수 상수·함수라 서버("use server" 없이도)와 클라이언트 양쪽에서 안전하게 쓴다.
// 2026-09-24: "육아랑 관련 없는데 육아 조언이 나온다"는 피드백 반영 — 온보딩 답변으로
// 홈 탭의 "오늘의 실천방법"을 실제 상황에 맞게 좁힌다.

// 질문 1: "내가 주로 즐거움을 느끼는 부분" — wellness_practices.category로 매핑.
// 목록 대부분이 신체 활동이라 "몸으로 움직이기"가 기본값에 가깝고, 명상/사람 만나기만 다르다.
export const ENJOYMENT_OPTIONS = [
  "마라톤",
  "피티/퍼스널 트레이닝",
  "테니스",
  "활동적인 운동",
  "필라테스",
  "발레",
  "요가",
  "명상",
  "사람 만나기",
  "기타",
] as const;
export type EnjoymentOption = (typeof ENJOYMENT_OPTIONS)[number];

export const ENJOYMENT_TO_CATEGORY: Record<EnjoymentOption, string> = {
  마라톤: "몸으로 움직이기",
  "피티/퍼스널 트레이닝": "몸으로 움직이기",
  테니스: "몸으로 움직이기",
  "활동적인 운동": "몸으로 움직이기",
  필라테스: "몸으로 움직이기",
  발레: "몸으로 움직이기",
  요가: "몸으로 움직이기",
  명상: "나를 돌보기",
  "사람 만나기": "관계·대화로 풀기",
  기타: "나를 돌보기", // 직접 작성은 자유 텍스트라 매핑이 없어 무난한 기본값으로
};

// 질문 2: "주요 고민거리" — wellness_practices.domain으로 매핑.
// domain에 없는 "학업"/"가족"은 가장 가까운 값으로 근사한다(완벽한 1:1 매핑은 아님).
export const CONCERN_OPTIONS = ["연애", "학업", "직장 및 커리어", "일상", "육아", "가족", "기타"] as const;
export type ConcernOption = (typeof CONCERN_OPTIONS)[number];

export const CONCERN_TO_DOMAIN: Record<ConcernOption, string> = {
  연애: "연인관계·부부생활",
  학업: "나 자신",
  "직장 및 커리어": "회사·커리어",
  일상: "나 자신",
  육아: "육아",
  가족: "인간관계",
  기타: "나 자신",
};
