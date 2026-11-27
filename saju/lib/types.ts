import type { TestSlug } from "./tests";

// 입력 화면(/birth)에서 모으는 값. 생년월일은 사주 계산에만 쓰고 공유 그림·상담 대화에 넣지 않는다.
export type BirthInput = {
  calendar: "양력" | "음력" | "음력(윤달)";
  year: number;
  month: number;
  day: number;
  timeKnown: boolean;
  hour: number;
  minute: number;
  timeSlot: string | null; // 시간을 모를 때 "오전(6~12시)" … "전혀 몰라요"
  region: string | null;
  gender: "여성" | "남성" | "선택 안 함";
};

// 엔진(report.buildPage)이 돌려주는 결과. 키가 많아 필요한 곳에서 좁혀 쓴다(engine/05_예시/example_result_1996.json 참고).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SajuPage = Record<string, any> & { test: string; stop?: boolean };

export type StoredResult = {
  id: string;
  slug: TestSlug;
  createdAt: string;
  nickname: string;
  worry: string;
  page: SajuPage; // 4쪽부터의 내용은 결제 전에는 화면으로 보내지 않는다(서버에서 거름)
  paid: boolean;
  paidAt: string | null;
  safetyLevel: "none" | "watch" | "urgent";
  timeNote: string;
  // 쏘웰라로 넘기는 작심삼일 다섯 칸(lib/challenge.ts). Supabase로 옮길 때 report.challenge에 그대로 넣는다.
  challenge: import("./challenge").HandoffChallenge | null;
};
