// 사주 엔진(engine/03_코드, 설계 패키지 원본 .mjs)의 타입 선언.
// 엔진은 타입 없이 쓰인 JS라, 앱에서 쓰는 함수만 느슨하게 적어 둔다(결과 모양은 lib/types.ts의 SajuPage).

declare module "ssol-saju-engine/report" {
  export function buildPage(
    input: Record<string, unknown>,
    test: string,
    sub?: string | null,
    month?: number,
    worry?: string,
    nick?: string,
    today?: Date,
    parsed?: unknown,
    opt?: Record<string, unknown>,
  ): Record<string, unknown>;
}

declare module "ssol-saju-engine/safety" {
  export function safetyCheck(
    text: string,
    ai?: unknown,
  ): { level: "none" | "watch" | "urgent"; stop: boolean; flagged: boolean; violence?: boolean; fear?: boolean };
}

declare module "ssol-saju-engine/followup" {
  export type FollowupOption = { id: string; label: string; text?: string };
  export type FollowupQuestion = { key: string; ask: string; options: FollowupOption[]; [k: string]: unknown } | null;
  export type FollowupAnswer = { q: string; id: string };
  export const FOLLOWUP: Record<string, unknown>;
  export function planFollowup(
    text: string,
    test?: string,
    db?: unknown,
    opt?: { urgent?: boolean; name?: string },
  ): { ask: boolean; read: unknown; intro: string | null; question: FollowupQuestion };
  export function nextQuestion(db: unknown, test: string, answers: FollowupAnswer[], text: string): FollowupQuestion;
  export function composeWorry(text: string, answers: FollowupAnswer[], db?: unknown): string;
}

declare module "ssol-saju-engine/core" {
  export function timeCandidates(
    input: Record<string, unknown>,
    slot: "오전" | "오후" | "저녁" | "밤",
  ): { note: string; commonSals: string[]; dayPillarChanges: boolean };
}
