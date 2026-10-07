// 이론 탐색을 열면 안 되는 상황 신호(2026-10-07 owner 재판정: "이론 제외 조건", D18/D19). 순수 함수라 테스트할 수 있다(exclusion.test.ts).
//
// 🔒 안전 라우터는 건드리지 않는다. 라우터가 이미 일반 경로(wellness/life_decision)로 통과시킨 대화에서만 "이론 탐색(선택 칩·탐색 대화)을 열지 않는" 보조 신호다.
// 신호가 있으면 흐름을 끝내고 평소 대화(안전 규칙·시스템 프롬프트가 그대로 적용되는 경로)로 답한다. 이론 선택 AI에게 맡기지 않고 키워드로 먼저 막는 이유:
// AI 판단은 비용·지연이 있고 결과가 흔들리지만, 이 상황들은 놓쳤을 때의 피해(사별 중인 사람에게 의미 찾기 질문, 폭언을 겪는 사람에게 "생각을 점검해보세요")가 크기 때문이다.
// 단어 목록은 초안이며 실제 대화 로그를 보며 넓혀 간다. 놓치면 이론 선택 단계로 가므로, 목록이 틀려도 "탐색을 덜 여는 쪽"으로만 틀리도록(과하게 걸리는 쪽) 넉넉히 잡았다.
export type ExclusionReason =
  | "bereavement" // 사별·최근 상실 — MCP·LOGO·WBT·PPT·IPT 비적용, 공감 먼저
  | "illness_self" // 본인의 질병·고통 — 의미 찾기(태도 가치) 작업 금지
  | "illness_other" // 가족·타인의 질병·고통 — 같은 이유로 금지(2026-10-07 owner 요청으로 본인과 나눔)
  | "illness_unspecified" // 병 이야기인데 누구의 병인지 문장만으로 알 수 없음 — 안전 쪽으로 닫는다
  | "livelihood" // 생활·경제 문제가 먼저(D18)
  | "workplace_abuse" // 직장 폭언·괴롭힘(D18) — 인지 계열("예민한 건 아닐까")로 가면 안 됨
  | "unsafe_relationship" // 폭력·통제 관계(D19) — 라우터가 놓친 경우의 안전망
  | "verdict_request" // 판정·원인 단정 요청("점수로 알려줘", "○○ 때문이죠?")
  | "death_imagery" // 죽음 이미지 기법을 직접 요청
  | "forgiveness" // 용서 질문 — 용서 과정을 안내하지 않는다
  | "safety_net"; // 아동 학대·성적 피해·섭식 문제 — 안전 라우터가 먼저 막지만, 라우터 판단이 흔들릴 때를 대비한 이중 안전망(2026-10-07)

export type IllnessReason = "illness_self" | "illness_other" | "illness_unspecified";
// 질병 이외의 종류는 단어 목록으로 잡고, 질병은 아래 ILLNESS_WORDS + illnessOwner(주어로 구분)로 따로 잡는다.
export const THEORY_EXCLUSION_SIGNALS: Record<Exclude<ExclusionReason, IllnessReason>, string[]> = {
  // "그리워"는 일상 그리움("친구가 그리워요")에 너무 자주 걸려 뺐다. 사별은 돌아가신/사별 같은 직접 표현으로만 잡는다.
  bereavement: ["돌아가셨", "돌아가신", "돌아가시", "사별", "세상을 떠", "세상을 뜨", "하늘나라", "먼저 떠나", "임종", "유가족", "상을 치", "장례", "49재", "추모", "무지개다리", "떠나보냈", "반려견이 죽", "반려묘가 죽", "강아지가 죽", "고양이가 죽", "반려동물이 죽", "유산했", "유산을", "유산이", "사산", "아이를 잃"],
  livelihood: ["먹고사는", "먹고 사는", "먹고살", "먹고 살", "생활비", "월세", "빚이", "빚을", "빚때", "카드값", "대출", "실직", "해고", "월급이 밀", "임금 체불", "굶어", "끼니를"],
  workplace_abuse: ["폭언", "괴롭힘", "갑질", "욕설", "인격 모독", "모욕을 당", "모욕적인 말", "직장 내 괴롭", "왕따"],
  // "맞고/맞았"는 "의견이 안 맞고", "예상이 맞았는데"에 걸려서, 사람에게 맞았다는 뜻이 분명한 표현만 쓴다. "폭력"도 "폭력적인 영화"에 걸려서 당했다/가정폭력류만 쓴다.
  unsafe_relationship: ["물건을 던", "물건 던", "때려", "때리", "한테 맞았", "한테 맞고", "한테 맞아서", "에게 맞았", "에게 맞고", "에게 맞아서", "맞고 살", "맞은 적", "맞던", "폭행", "가정폭력", "데이트폭력", "폭력을 당", "폭력을 써", "폭력을 행사", "휴대폰을 검사", "핸드폰을 검사", "못 만나게", "스토킹", "협박", "위협", "소리를 질러", "소리를 지르", "소리 지르"],
  // 2026-10-07 owner: "~때문이죠?"·"무슨 유형" 같은 일상 말투는 판정 요청이 아니라서 뺐다(이론을 적용한다). 점수·진단·판정을 직접 요청하는 표현만 남긴다.
  verdict_request: ["점수로 알려", "점수로 말해", "진단해", "판정해"],
  // "유서"는 "유서 깊은 가게"에 걸려서 유서를 쓴다는 표현만 쓴다.
  death_imagery: ["장례식", "유서를", "유서 쓰", "유서 써", "묘비", "내 죽음", "제 죽음", "죽음을 상상", "죽는다고 상상", "죽음 이미지"],
  forgiveness: ["용서"],
  // 실제 라우터 확인(2026-10-07): 아동 학대·성적 피해는 violence, 섭식 문제·유산은 clinical_distress로 이미 막힘. 이 목록은 분류기가 다르게 판단할 때를 위한 안전망이다.
  safety_net: ["성추행", "성폭행", "성폭력", "성희롱", "아이를 때렸", "아이를 학대", "아이를 폭행", "학대를 당", "학대당", "먹고 나면 토", "먹고 토", "폭식", "거식", "구토를 유도", "토하게 만"],
};
const SIGNALS = THEORY_EXCLUSION_SIGNALS;

// 질병·고통 단어. "말기"만으로는 "말기 프로젝트"에 걸려서 병과 붙은 표현만 쓴다. 누구의 병인지는 아래 illnessOwner가 문장 속 주어로 나눈다.
export const ILLNESS_WORDS = ["많이 아픈", "많이 아프", "많이 아파", "아프세요", "아프셔", "투병", "암 진단", "암이래", "암에 걸", "말기 암", "암 말기", "말기암", "말기 환자", "시한부", "입원", "간병", "수술을 앞", "큰 병", "중병", "치매"];
// "아프" 뒤에 "리카"가 오면(아프리카) 병 이야기가 아니다.
const SELF_SUBJECT = /(제가|내가|저는|나는)\s*(몸이\s*)?(많이\s*)?(아프(?!리카)|아파|병|암|입원|수술|투병|시한부)/;
const SELF_MARKERS = ["제가", "내가", "저는", "나는", "제 몸", "내 몸", "제 병", "내 병"];
const OTHER_NOUNS = ["가족", "엄마", "어머니", "어머님", "아빠", "아버지", "아버님", "부모", "남편", "아내", "배우자", "남자친구", "여자친구", "애인", "아이", "아들", "딸", "동생", "형이", "누나", "언니", "오빠", "할머니", "할아버지", "친구", "동료", "지인", "시어머니", "장모"];

const OTHER_ILL = new RegExp(`(${OTHER_NOUNS.join("|")})(이|가|께서)?\\s*(많이\\s*)?(아프(?!리카)|아파|아프셔|편찮)`);

// 병 이야기가 나온 한 메시지에서 누구의 병인지 가른다. 순서: 본인이 주어라고 분명한 표현 → 가족·타인 명사 → "제가/내가" 같은 본인 표시 → 알 수 없음.
export function illnessOwner(text: string): "illness_self" | "illness_other" | "illness_unspecified" | null {
  if (SELF_SUBJECT.test(text)) return "illness_self"; // "제가 아프니까…"처럼 단어 목록에 없어도 주어가 분명하면 병 이야기로 본다
  if (OTHER_ILL.test(text)) return "illness_other";
  if (!ILLNESS_WORDS.some((w) => text.includes(w))) return null;
  if (OTHER_NOUNS.some((n) => text.includes(n))) return "illness_other";
  if (SELF_MARKERS.some((m) => text.includes(m))) return "illness_self";
  return "illness_unspecified";
}

// 2026-10-07 owner 결정: 생활·경제 문제(D18)와 직장 폭언·괴롭힘은 이론 탐색을 열어도 된다(생활 안내·신고 안내를 먼저 할 필요 없음).
// D19: 폭력·통제 관계도 이론 탐색을 열어도 된다 — 공감하고, 여러 차례 반복되면 안내하는 기존 안내 규칙(안전 라우터의 폭력 route·"신체적 위협인지 먼저 확인")이 그대로 적용된다. 실제 신체 위험은 라우터가 이 흐름 이전에 막는다.
// D20: "용서"라는 단어도 써도 된다 — 누군가에게 용서를 구하는 과정이 아니라 본인 감정을 꺼내놓는 말이다.
// 단어 사전은 나중에 다시 닫거나 다른 용도(예: 실천 필터)로 쓸 수 있게 남겨 두고, 여기서만 "탐색을 닫는 신호"에서 뺀다.
export const OPEN_ALLOWED_REASONS: readonly ExclusionReason[] = ["livelihood", "workplace_abuse", "forgiveness", "unsafe_relationship"];

// 2026-10-07 owner: "애매"로 표시했던 문장도 이론을 적용한다. 신호 단어가 있어도 아래 경우는 탐색을 닫지 않는다.
//  - 오래된 상실: "할머니가 돌아가신 지 3년 됐는데…" — 사별 규칙은 "최근 상실"이 대상이다(2년 이상·몇 년·오래전·어릴 때가 함께 나오면 닫지 않음).
//  - 병문안: "입원한 친구를 병문안 다녀왔어요" — 본인·가족의 질병과 크게 상관이 없는 이야기다.
// "친구가 갑자기 죽었어요"처럼 가까운 사람 + (낱말 하나쯤) + 죽었 형태. 단어 목록으로는 사이에 낱말이 끼면 놓친다.
const CLOSE_DEATH = /(친구|남편|아내|배우자|아이|아들|딸|부모님|엄마|아빠|어머니|아버지|동생|언니|오빠|누나|형|가족|연인|남자친구|여자친구)(가|이)\s*(\S+\s*)?죽었/;
const OLD_LOSS = /([2-9]|\d{2,})\s*년|몇\s*년|수년|오래\s*전|오래전|어릴\s*때|어렸을\s*때/;
function isExempt(reason: string, text: string): boolean {
  if (reason === "bereavement") return OLD_LOSS.test(text);
  if (reason.startsWith("illness")) return text.includes("병문안");
  return false;
}

// 이번 메시지와 직전 사용자 발화 두 개를 본다(한 번 걸린 신호는 다음 한두 턴 동안 유지 — 곧바로 탐색으로 돌아가지 않기 위해).
export function detectTheoryExclusion(message: string, recentUserMessages: string[] = []): ExclusionReason | null {
  const texts = [message, ...recentUserMessages.slice(-2)];
  for (const reason of Object.keys(SIGNALS) as (keyof typeof SIGNALS)[]) {
    if (OPEN_ALLOWED_REASONS.includes(reason)) continue;
    if (texts.some((t) => !isExempt(reason, t) && (SIGNALS[reason].some((w) => t.includes(w)) || (reason === "bereavement" && CLOSE_DEATH.test(t))))) return reason;
  }
  for (const t of texts) {
    const owner = isExempt("illness", t) ? null : illnessOwner(t);
    if (owner) return owner;
  }
  return null;
}
