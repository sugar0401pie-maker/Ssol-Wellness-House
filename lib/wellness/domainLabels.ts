// 심리테스트 프로토타입의 5개 영역 키↔한국어 라벨. 서버(generate.ts의 페르소나 힌트)와
// 클라이언트(마이페이지 화면)가 같은 라벨을 쓰도록 여기 한 곳에 모아둔다.
// I/O가 없는 순수 상수라 "use client"/"server-only" 어느 쪽에서도 안전하게 import할 수 있다.
export const DOMAIN_LABELS: Record<string, string> = {
  relate: "관계·소속",
  worth: "자기가치·인정",
  control: "통제·미래",
  happy: "행복",
  meaning: "의미·방향",
};
