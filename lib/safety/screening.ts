// 스크리닝 흐름의 순수 판단 로직 (2026-10-23, docs/안전설계_스크리닝흐름_v0.3.md 1단계: S1·S2).
// 위험 단서가 보이면 AI가 계속 말하지 않고 → 고정 질문 한 번 → 답에 따라 고정 안내 / 평소 대화.
// 🔒 AI 호출이 없다(키워드·규칙만) — AI 장애와 무관하게 동작해야 하기 때문이다. 네트워크·DB 접근도 없어 단위 테스트가 된다.
// 대화 중 상태는 assistant 메시지의 reflection_signal_id 표시("sw-scr:종류:단계")로 남긴다(새 DB 칸 불필요).

export type ScreenKind = "suicide" | "violence";
// asked=질문함 · ok=아니요(일반 안내) · unclear=애매(안내+watch) · stop=위험(중단, 새 대화 전까지 유지)
export type ScreenStage = "asked" | "ok" | "unclear" | "stop";
export type ScreenMarker = { kind: ScreenKind; stage: ScreenStage };

export const SCREEN_MARK = "sw-scr";
export const makeScreenMarker = (kind: ScreenKind, stage: ScreenStage) => `${SCREEN_MARK}:${kind}:${stage}`;
export function parseScreenMarker(v: string | null | undefined): ScreenMarker | null {
  const m = v?.match(/^sw-scr:(suicide|violence):(asked|ok|unclear|stop)$/);
  return m ? { kind: m[1] as ScreenKind, stage: m[2] as ScreenStage } : null;
}

// 운영 검토 표시(watch): 위험 확인(stop)·애매한 답(unclear)·죽음 이야기에 "아니요"(suicide ok — Q2). 관리자 화면(4단계)이 이 기준으로 찾는다.
export const isWatchMarker = (m: ScreenMarker) => m.stage === "stop" || m.stage === "unclear" || (m.kind === "suicide" && m.stage === "ok");

// ───── S1 단서: 죽음을 자기 일로 직접 말함(Q1). 조문·"장례식장 다녀왔어요" 같은 일상은 걸리지 않게 "내/제 + 죽음 이미지"나 직접 표현만 쓴다.
// 명백한 자살·자해 표현("죽고 싶다" 등)은 이 앞단의 안전 라우터가 먼저 위기로 처리하므로 여기까지 오지 않는다.
const DEATH_TALK = [
  /유서(?!\s*깊)/, // "유서 깊은 가게" 제외
  /(?<![가-힣])(내|제|나의|저의)\s*(장례식|묘비|죽음|마지막)/,
  /죽음을\s*상상|죽는\s*(다고\s*)?상상|죽는\s*장면/,
  /(삶|생|목숨)을\s*(끊|마감|끝내)/,
  /(?<![가-힣])(내가|제가|나)\s*(만약\s*)?죽으면|죽고\s*나면|죽은\s*뒤에\s*(가족|사람들)/,
];
// S1-e(CSO 1-4, 🟠): 예전 시도 + 지금 많이 힘듦("예전에 한 번… 요즘 그때 같아요") — 왜 그렇게 느끼는지 먼저 묻고 답에 따라(검수표). 같은 직접 질문(자살·자해 생각 여부)으로 묻는다.
// 키워드 판정에 안 걸렸는데 분류기도 일반 경로로 보낸 경우(2026-10-26 검수 예시 판정 결과에서 반응이 없던 빈틈)를 막는다.
const PAST_ATTEMPT_NOW = /(예전|전에|과거|몇\s*년\s*전|작년|어릴\s*때).{0,20}(시도(해|했|한)|죽으려\s*(고\s*)?(했|해)|자해(를)?\s*(했|한)|자살(을)?\s*(시도|하려)).{0,40}(요즘|지금|최근|이번에).{0,20}(그때\s*(같|처럼|랑\s*비슷)|그때와\s*비슷|또\s*그럴)|(요즘|지금|최근).{0,16}그때\s*(같|처럼)(은\s*)?(기분|느낌|마음)?.{0,30}(시도|죽으려|자해|자살)/;
export const hasDeathTalk = (text: string) => DEATH_TALK.some((r) => r.test(text)) || PAST_ATTEMPT_NOW.test(text);

// ⚠ 안전 판정을 한 단계 "질문 먼저"로 바꾸는 유일한 곳(상담사님 R2·대표님 2026-10-23: 죽음 이미지 활동 요청은 곧바로 위기 문구가 아니라 먼저 직접 묻는다).
// 실제 확인(2026-10-23): 지금은 AI 분류기가 이런 "활동 요청" 문장을 곧바로 위기(crisis)로 보낸다. 아래 조건을 **모두** 만족할 때만 질문으로 바꾼다:
//  ① 키워드 규칙에는 걸리지 않고 분류기만 위기로 봤고(source=classifier — 키워드 걸림이 있으면 keyword+classifier라 제외) ② 죽음 이미지 + "활동을 해보겠다/써보겠다" 요청 표현이며
//  ③ 본인의 자살·자해 의사를 말하는 표현("죽고 싶다", "자살", "자해", "살 이유 없다" 등)이 전혀 없음. 하나라도 어긋나면 기존 위기 고정 응답 그대로다.
const ACTIVITY_REQUEST = /(활동|해보고|해볼|해보려|써보|써볼|쓰려|쓰고\s*싶|상상해|명상|연습|과제|하라는|해보래|써보래|해도\s*될)/;
const SELF_HARM_INTENT = /(자살|자해|죽고\s*싶|죽을\s*것\s*같|죽어\s*버|죽을래|죽으려|끝내고\s*싶|사라지고\s*싶|살\s*이유|살기\s*싫|그만\s*살|극단|목숨을\s*끊|삶을\s*끊|생을\s*마감)/;
export const isDeathActivityRequest = (text: string) => hasDeathTalk(text) && ACTIVITY_REQUEST.test(text) && !SELF_HARM_INTENT.test(text);
export function canSoftenCrisis(d: { route: string; source: string; classifierUnavailable: boolean }, message: string): boolean {
  return d.route === "crisis" && d.source === "classifier" && !d.classifierUnavailable && isDeathActivityRequest(message);
}

// ───── S2 단서: 정서적 학대·통제(가스라이팅, V3~V6) · 약한 신체 위협. 명백한 신체 폭력·성범죄는 라우터가 먼저 폭력 고정 안내로 처리한다.
// "엄마가 일정을 조종하려 해요", "팀장님 눈치 봐요" 같은 일상은 제외 — 무서움이 함께일 때만 눈치를 단서로 본다(CSO 1-4 V6).
const ABUSE_CUES = [
  /가스라이팅|정서적\s*학대|정신적\s*(폭력|학대)|언어\s*폭력/,
  /(기억|제\s*말)이?\s*(다\s*)?(틀렸|이상하다|거짓)|이상한\s*사람이래|제가\s*예민하대/,
  /(카톡|문자|휴대폰|핸드폰|폰|비밀번호).{0,12}(다\s*)?(보여\s*달|보여달|검사|확인하|알려\s*달|알려달)/,
  /(위치|동선).{0,8}(공유|보고)\s*(하라|하게|를\s*강요|해야)/,
  /못\s*만나게|만나지\s*말라|친구를?\s*못\s*만나/,
  /(집|회사|직장)\s*앞(에서|에)\s*(계속\s*)?(매일\s*)?(기다|와요|서\s*있)|번호를?\s*바꿔도\s*(계속\s*)?연락|몰래\s*들어/,
  /(월급|급여|카드|통장).{0,10}(다\s*)?(가져가|관리하|뺏)|생활비를?\s*(안\s*주|끊)|영수증.{0,6}검사|(만\s*원|돈).{0,10}허락/,
  /물건을?\s*던|소리를?\s*(지르|질러)|소리\s*지르|벽을?\s*(치|쳐)/,
];
const FEAR_AND_WATCHING = /(무서|겁이?\s*나|두려|큰일\s*(나|날)|혼\s*날|난리\s*(나|날)).{0,20}(눈치|화낼까|기분)|(눈치|화낼까|기분).{0,20}(무서|겁이?\s*나|두려|큰일\s*(나|날)|혼\s*날|난리\s*(나|날))/;
export const hasAbuseCue = (text: string) => ABUSE_CUES.some((r) => r.test(text)) || FEAR_AND_WATCHING.test(text);

// 이 대화에서 단서가 나온 사용자 메시지 수(이번 메시지 포함). 질문은 2번째부터(Q5), 같은 대화 안만 센다(Q7).
export const ABUSE_CUE_THRESHOLD = 2;
export function countAbuseCueMessages(message: string, recentUserMessages: string[]): number {
  return [message, ...recentUserMessages].filter(hasAbuseCue).length;
}

// ───── 답 분류(규칙만). 애매하면 unclear — 안전한 쪽(안내 + watch, Q4).
export type ScreenAnswer = "yes" | "no" | "unclear";
const strip = (t: string) => t.replace(/[\s.,!?~…"'“”‘’()]/g, "");
const STRONG_NO = /(없어요|없습니다|없었어요|없는데|없네요|없다|아니요|아니에요|아니예요|아닙니다|아뇨|아니야|안느껴|안느끼|괜찮아요|안전해요|전혀)/;
const DOUBLE_NEG = /(없는건아니|없진않|없지는않|아닌건아니|않은건아니)/;
const STRONG_YES = /(있어요|있었어요|있습니다|있었|해봤|생각해요|생각했|느껴요|느끼고|그래요|맞아요|무서워요|위협)/;
const YES_START = /^(네|넵|예|응|웅|있|맞|그래|가끔|종종|자주|조금|좀|사실)/;

export function classifyScreenAnswer(text: string): ScreenAnswer {
  const t = strip(text);
  if (!t || t.length > 40) return "unclear"; // 길면 다른 이야기를 섞었을 수 있어 규칙으로 정하지 않는다
  if (DOUBLE_NEG.test(t)) return "unclear";
  const no = STRONG_NO.test(t);
  const yes = STRONG_YES.test(t) || YES_START.test(t);
  if (no && /^(네|넵|예|응|웅)/.test(t) && !STRONG_YES.test(t) && /없/.test(t)) return "no"; // "네, 없어요"
  if (no && yes) return "unclear";
  if (no) return "no";
  if (yes) return "yes";
  return "unclear";
}

// ───── 이번 메시지에 어떻게 할지
export type ScreenInput = {
  message: string;
  recentUserMessages: string[]; // 이번 메시지 이전의 사용자 메시지(이 대화)
  markers: ScreenMarker[]; // 이 대화에서 지금까지 남은 스크리닝 표시 전부
  pending: ScreenMarker | null; // 직전 쏘웰라 답변에 붙은 표시(없으면 null)
  routeIsFixed: boolean; // 안전 라우터가 위기·폭력으로 판정함 → 기존 고정 응답이 처리한다
};
export type ScreenAction =
  | { type: "none" }
  | { type: "stop_repeat"; kind: ScreenKind }
  | { type: "ask"; kind: ScreenKind }
  | { type: "answer"; kind: ScreenKind; result: ScreenAnswer };

export function decideScreening(i: ScreenInput): ScreenAction {
  if (i.routeIsFixed) {
    // 라우터가 위기·폭력으로 판정했다 → 기존 고정 응답이 우선(새 위기 표현도 그쪽이 받는다). 단 질문 직후의 "예"는 같은 고정 응답을 쓰되 중단 상태를 남겨야 이후 메시지가 이어서 중단된다.
    // 질문 직후의 "아니요"·애매한 답에 라우터가 위기를 보낸 경우는 더 조심스러운 쪽(라우터의 고정 응답)을 그대로 따른다.
    if (i.pending?.stage === "asked" && classifyScreenAnswer(i.message) === "yes") return { type: "answer", kind: i.pending.kind, result: "yes" };
    return { type: "none" };
  }
  const stopped = i.markers.find((m) => m.stage === "stop");
  if (stopped) return { type: "stop_repeat", kind: stopped.kind }; // Q3 ③ 새 대화를 시작하기 전까지
  if (i.pending?.stage === "asked") return { type: "answer", kind: i.pending.kind, result: classifyScreenAnswer(i.message) };
  const asked = (k: ScreenKind) => i.markers.some((m) => m.kind === k); // 같은 질문은 한 대화에서 한 번만
  if (hasDeathTalk(i.message) && !asked("suicide")) return { type: "ask", kind: "suicide" };
  if (countAbuseCueMessages(i.message, i.recentUserMessages) >= ABUSE_CUE_THRESHOLD && hasAbuseCue(i.message) && !asked("violence")) return { type: "ask", kind: "violence" };
  return { type: "none" };
}

// 답에 따른 결과: 어떤 단계 표시를 붙이고 어느 문구를 보낼지(문구 키).
export function outcomeFor(result: ScreenAnswer): { stage: Exclude<ScreenStage, "asked">; text: "risk" | "ok" | "unclear" } {
  if (result === "yes") return { stage: "stop", text: "risk" };
  if (result === "no") return { stage: "ok", text: "ok" };
  return { stage: "unclear", text: "unclear" };
}
