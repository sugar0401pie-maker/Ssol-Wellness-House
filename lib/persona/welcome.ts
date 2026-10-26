// 점성술(쏠 아스트로 하우스) 결과를 보고 넘어온 사용자를 위한 환영 인사와 시작 문구(2026-10-22, 대표님 요청).
// 브라우저에서도 쓰이므로 "server-only"를 넣지 않는다. 점성술에서 고른 "요즘 제일 신경 쓰이는 부분"(Q1) 답은 사용자가 직접 고른 것이라 시작 문구를 그 영역에 맞춘다.
// 별자리·행성 같은 점성술 전용 말은 여기서도 쓰지 않는다(채팅 제한과 같은 원칙 — 서비스 이름 "쏠 아스트로 하우스"만 쓴다).
import { EVERYDAY_QUESTION_GROUPS, type SuggestedQuestion } from "./suggestedQuestions.ts";

export const DEFAULT_GREETING =
  "안녕하세요, 쏠 웰니스 하우스예요. 저는 웰니스 관련 상담에 도움을 드릴 수 있습니다. 요즘 마음에 머무는 이야기가 있다면 편하게 들려주시기 바랍니다.";

// 점성술 Q1 답(CSO 표와 같은 글자) → 그 영역의 시작 문구. 모두 일반 대화로 보내는 말이라 테스트가 필요 없다.
export const ASTRO_Q1_CHIPS: Record<string, SuggestedQuestion[]> = {
  "직업·커리어": EVERYDAY_QUESTION_GROUPS[0].questions,
  "교우·사회관계": EVERYDAY_QUESTION_GROUPS[1].questions,
  "진로·자기계발": EVERYDAY_QUESTION_GROUPS[3].questions,
  연애: [
    { id: "ed-love-1", text: "연애할 때 내 마음을 표현하기가 어려워요" },
    { id: "ed-love-2", text: "연락이 늦으면 자꾸 신경이 쓰여요" },
    { id: "ed-love-3", text: "사랑받고 있다는 확신이 잘 안 들어요" },
  ],
  가족: [
    { id: "ed-fam-1", text: "가족과 이야기하면 마음이 무거워져요" },
    { id: "ed-fam-2", text: "가족에게 내 마음을 설명하기가 어려워요" },
    { id: "ed-fam-3", text: "가족을 챙기느라 내 시간이 없어요" },
  ],
  "재정·생활안정": [
    { id: "ed-fin-1", text: "생활이 빠듯해서 마음이 자꾸 쓰여요" },
    { id: "ed-fin-2", text: "돈 걱정이 자꾸 머릿속에 맴돌아요" },
    { id: "ed-fin-3", text: "앞으로의 생활이 안정될지 걱정돼요" },
  ],
};

// astroGreeting: 점성술 [쏘웰라와 대화 시작하기]로 들어온 직후에만 오는 그 결과의 맞춤 첫 인사(lib/persona/astroGreeting.ts, 2026-10-26).
export type TarotWelcome = { worry: string | null; card: string | null };

export type WelcomeStatus = {
  hasPersona: boolean;
  astroQ1: string | null;
  fromAstro: boolean;
  nickname: string | null;
  astroGreeting?: string | null;
  /** 디저트 테스트 결과의 유형 이름(예: "피스타치오 크루아상"). 결과가 없으면 null/없음. */
  typeName?: string | null;
  /** 이 결과로 만든 심층 리포트가 완성돼 있는지. */
  hasReport?: boolean;
  /** 쏠 타로 하우스 결과 10쪽 버튼(…/chat?from=tarot&result=id)으로 넘어온 경우 그 결과의 고민 글과 세 번째 카드(2026-10-26 owner 결정 — 고민 내용까지 언급). */
  tarot?: TarotWelcome | null;
};

/** 인사말에 넣을 고민 글 앞부분(줄바꿈은 띄어쓰기로, 길면 max자에서 자르고 …). */
export function worryExcerpt(text: string | null | undefined, max = 40): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…";
}

// 2026-10-26: 점성술 맞춤 인사가 있으면 그것이 우선, 다음은 타로 버튼으로 온 경우의 타로 인사, 점성술에서 오지 않았어도 디저트 테스트 결과가 있으면 그 유형 이름으로 인사한다
// (결제한 리포트가 있으면 리포트도 언급). 둘 다 없으면 기본 인사.
export function welcomeGreeting(
  s: Pick<WelcomeStatus, "fromAstro" | "nickname" | "astroGreeting" | "tarot"> & Partial<Pick<WelcomeStatus, "hasPersona" | "typeName" | "hasReport">>,
): string {
  if (s.astroGreeting) return s.astroGreeting;
  if (s.tarot) {
    const name = s.nickname?.trim() ? `${s.nickname.trim()}님, ` : "";
    const worry = worryExcerpt(s.tarot.worry);
    const parts = [`안녕하세요, ${name}쏠 타로 하우스에서 오셨군요. 반가워요!`];
    if (worry) parts.push(`‘${worry}’ 고민으로 세 장을 뽑으셨죠.`);
    parts.push(s.tarot.card ? `앞으로의 열쇠로 나온 ‘${s.tarot.card}’ 이야기를 이어서 나눠 볼까요?` : "타로에서 본 이야기를 이어서 나눠 볼까요?");
    parts.push("결과를 보며 마음에 남은 문장이 있다면 편하게 들려주세요.");
    return parts.join(" ");
  }
  const name = s.nickname?.trim() ? `${s.nickname.trim()}님, ` : "";
  if (!s.fromAstro) {
    const type = s.hasPersona === false ? "" : s.typeName?.trim();
    if (!type) return DEFAULT_GREETING;
    return s.hasReport
      ? `안녕하세요, ${name}${type} 유형 결과와 심층 리포트를 함께 살펴볼 수 있어요. 반가워요! 리포트를 보며 마음에 남은 이야기가 있다면 편하게 들려주세요. 아래에서 고르셔도 좋아요.`
      : `안녕하세요, ${name}${type} 유형 결과를 보고 오셨군요. 반가워요! 결과를 보며 마음에 남은 이야기가 있다면 편하게 들려주세요. 아래에서 고르셔도 좋아요.`;
  }
  return `안녕하세요, ${name}쏠 아스트로 하우스에서 오셨군요. 반가워요! 결과를 보며 마음에 남은 이야기가 있다면 편하게 들려주세요. 아래에서 고르셔도 좋아요.`;
}

// 첫 화면 시작 칩 3개. 점성술 Q1 답이 있으면 그 영역의 문구를 먼저 보여 주고, 아니면 (테스트 결과가 있으면 성향 질문, 없으면 일상 문구).
export function chooseStarterChips(
  s: WelcomeStatus,
  pools: { persona: SuggestedQuestion[]; everyday: SuggestedQuestion[] },
): { chips: SuggestedQuestion[]; persona: boolean } {
  const area = s.astroQ1 ? ASTRO_Q1_CHIPS[s.astroQ1] : undefined;
  if (area) return { chips: area.slice(0, 3), persona: false };
  return s.hasPersona ? { chips: pools.persona, persona: true } : { chips: pools.everyday, persona: false };
}
