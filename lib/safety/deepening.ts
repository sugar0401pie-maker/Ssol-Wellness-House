// 깊어짐(③) 신호 판별 — 순수 함수(2026-10-27, docs/깊어짐_설계_v0.1.md). 전문위원 검수 묶음 1-3 · 대표님 결정: **신호 판별은 AI가 아니라 단어·문장 판별식으로만 한다**
// (AI가 판별하면 일상 고민을 병증으로 오인해 전부 전문의로 넘길 위험이 큼). 이 파일에는 AI 호출이 없다.
// 같은 고민(뿌리)이 나아지지 않고 깊어지면 전문의·상담 기관 정보를 **한 번** 안내하고 대화는 계속한다 — 휴먼 웰니스 세션은 권하지 않는다(상담사님).
// "먼저 묻기"(③-9): 깊어짐으로 보이는 말도 단어만으로 세지 않고, 쏘웰라가 왜 그렇게 느끼는지 물은 **다음 사용자 답**을 본 뒤에 센다. 상태를 따로 저장하지 않고 대화 기록(직전 사용자 말·직전 쏘웰라 답변)만으로 계산한다.
// 패턴 목록은 초안이며 대화 로그를 보며 넓힌다. 놓치는 쪽(안내를 덜 하는 쪽)으로 틀릴 수 있다 — 위기·안전 신호(②)는 이 규칙과 별개로 언제나 먼저 동작한다.

export type DeepSignal = "E-1" | "E-2" | "E-4" | "E-6";

const HARD = /(힘들|힘겹|심해|나빠|괴로|버거|지쳐|무거워|막막)/;
// E-1: 과거와 비교해 더 힘들어졌다고 본인이 분명히 말함 — 정도 단어("조금→너무")만 바뀐 말은 세지 않는다.
const E1 = /(전보다|예전보다|지난번보다|지난달보다|갈수록|점점|요즘\s*들어\s*더|더\s*심해졌|더\s*힘들어졌|훨씬\s*(더\s*)?(힘들|심해|나빠|괴로|버거))/;
// E-2: 기간이 늘어남("요즘" → "몇 달째") — 2주 이상은 즉시 기준이 아니라 이 신호로만 센다.
const E2 = /(몇\s*달째|수개월|[2-9]\s*달째|\d{2}\s*달째|\d+\s*개월째|반\s*년(째|\s*넘|\s*동안)?|한\s*달\s*(넘|이상)|[2-9]\s*주째|몇\s*주째|오래전부터)/;
// E-4: 이유를 물은 뒤에도 절망·무가치감이 이어짐 — 이 패턴은 "후보"일 뿐, 이유를 물은 다음 답에도 남아 있을 때만 센다.
const E4 = /(해\s*봤자|소용\s*없|어차피\s*안\s*(될|돼|바뀔)|저는\s*원래\s*안\s*돼|뭘\s*해도\s*(안|소용)|희망이\s*없|아무\s*의미\s*없|쓸모\s*없|아무것도\s*안\s*바뀔)/;
// E-6: 운동을 못 하면 불안이 크게 커짐 + 상쇄 운동 시간·횟수가 늘어남(둘 다 있을 때). 먹는 양 이야기만으로는 세지 않는다(굶기가 며칠째면 SAFE-018이 따로 처리).
const E6_ANXIETY = /(운동|러닝|헬스|달리기).{0,14}(못\s*하면|안\s*하면|빼먹으면|거르면).{0,12}(불안|초조|죄책|못\s*견)/;
const E6_MORE = /(더\s*오래|시간을?\s*늘|횟수를?\s*늘|두\s*번씩|매일\s*두|하루\s*[2-9]\s*번|점점\s*더\s*(오래|많이))/;
// 나아지는 신호 — 하나라도 있으면 턴 수를 처음부터 다시 센다.
const IMPROVE = /(조금\s*(은\s*)?나아졌|좀\s*나아졌|나아지고\s*있|나아진\s*것\s*같|한결\s*(나|편)|해\s*봤는데\s*(괜찮|도움|좋)|해봤더니|해\s*봤어요|해봤어요|도움이?\s*됐)/;
// 일상 이유 — 먼저 묻기 뒤 답에 이게 있으면 그 신호는 세지 않는다("일 때문이라 그래요", "감기 걸려서").
const ORDINARY_REASON = /(일\s*때문|야근|시험|마감|이사|감기|몸살|출장|바빠서|프로젝트|과제|논문|발표|행사|여행|손님|독감|아파서\s*그래)/;
// 쏘웰라가 이유를 물었는지(직전 쏘웰라 답변).
const REASON_ASKED = /(왜\s*그렇게|무슨\s*일이|어떤\s*일이|이유가|계기가|무슨\s*일이\s*있|어떤\s*일이\s*있)/;

export function deepCandidates(text: string): DeepSignal[] {
  const t = text ?? "";
  const out: DeepSignal[] = [];
  if (E1.test(t) && HARD.test(t)) out.push("E-1");
  if (E2.test(t) && (HARD.test(t) || /계속/.test(t))) out.push("E-2");
  if (E4.test(t)) out.push("E-4");
  if (E6_ANXIETY.test(t) && E6_MORE.test(t)) out.push("E-6");
  return out;
}
export const isImproving = (text: string) => IMPROVE.test(text ?? "");
export const askedReason = (assistantText: string | null | undefined) => REASON_ASKED.test(assistantText ?? "");

export type DeepTurn = { confirmed: DeepSignal[]; improve: boolean; ask: DeepSignal[] };
// 이번 사용자 말(current)을 볼 때: ① 이번 말에 후보가 있으면 다음 쏘웰라 답변이 이유를 묻게 하고(ask) ② 직전 사용자 말의 후보는 직전 쏘웰라 답변이 이유를 물었고 이번 답에 일상 이유가 없을 때 확정한다
// (E-4는 이번 답에도 절망 표현이 남아 있어야 확정). ③ 이번 말이 나아지는 말이면 improve.
export function evaluateDeepening(current: string, previousUser: string | null | undefined, lastAssistant: string | null | undefined): DeepTurn {
  const ask = deepCandidates(current);
  const confirmed: DeepSignal[] = [];
  if (previousUser && askedReason(lastAssistant) && !ORDINARY_REASON.test(current)) {
    for (const s of deepCandidates(previousUser)) {
      if (s === "E-4" && !E4.test(current)) continue;
      confirmed.push(s);
    }
  }
  return { confirmed, improve: isImproving(current), ask };
}

// ───── 답변 지침(AI에게 주는 문장)
export const DEEPENING_ASK_BLOCK =
  "방금 사용자의 말에 '더 힘들어졌다', '오래됐다', '해 봐도 소용없다' 같은 마음이 깊어졌을 수 있다는 단서가 있습니다. 단어만으로 판단하지 마세요. 마음을 한 문장으로 알아준 뒤, 왜 그렇게 느끼는지·무슨 일이 있었는지를 부드럽게 한 가지만 물으세요. 전문기관 안내는 이번 답변에서 하지 마세요. 자살·자해라는 말을 먼저 꺼내지 마세요.";
export const DEEPENING_INFO_BLOCK =
  "사용자가 같은 고민을 오래 이야기해 왔고 힘든 마음이 나아지지 않고 깊어지고 있는 것으로 보입니다. 이번 답변에서 먼저 마음을 알아준 뒤, 정신건강의학과나 지역 정신건강복지센터, 상담 기관처럼 도움받을 수 있는 곳이 있다는 것을 제안형으로 한 번 부드럽게 안내하세요(번호는 넣지 않고, '꼭 가야 한다'가 아니라 '필요하다고 느끼실 때 찾아볼 수 있어요' 정도로). 진단명이나 병명을 말하지 마세요. 대화는 계속 이어가고, 휴먼 웰니스 세션을 권하지 마세요. 이 안내는 이번 한 번만 하고 되풀이하지 않습니다.";
export const deepeningAskBlock = (message: string): string | null => (deepCandidates(message).length ? `- ${DEEPENING_ASK_BLOCK}` : null);
