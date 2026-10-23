// 전문위원 검수 묶음 v0.7(CSO 안전 규칙 v3, 대표님 확정 2026-10-23)의 2단계: SAFE-018~021 + 폭력·통제 V1·V2.
// 순수 함수(네트워크·DB 없음). 두 가지 종류다:
//  ① 즉시 판정(instant): 키워드 규칙처럼 AI 없이 기존 위기·폭력 고정 응답으로 간다 — V1·V2(폭력), SAFE-020 본인 확신(🔴), SAFE-021 과다복용(🔴).
//  ② 답변 지침(guidance): 일반 대화로 답하되 AI에게 해당 지침 한 블록을 준다 — SAFE-018 섭식, 019 강박 운동, 020 현실감 확인, 021 술·약 의존·금단·음주운전·과음.
// 원칙(CSO 표): 일상 표현·비유·농담·과거·남 이야기·작품 이야기는 해당 없음, 애매하면 해당 없음(②의 확인 질문이 있는 항목만 예외).
// 진단명은 쓰지 않고, 증상을 캐묻지 않으며, 휴먼 웰니스 세션을 권하지 않는다(상담사님 결정 — 병증 의심은 외부 전문 도움).

export type InstantHit = { ruleId: "SAFE-001" | "SAFE-020" | "SAFE-021"; route: "crisis" | "violence"; trigger: string };

const PAST = /(예전|옛날|작년|몇\s*년\s*전|어릴\s*때|어렸을\s*때|과거에|학생\s*때)/;
const NON_FIRST = /(드라마|영화|웹툰|소설|꿈에서|ㅋㅋ|ㅎㅎ|비유|농담|친구가|지인이|가족이|엄마가\s*그러|뉴스)/;
const HEARSAY = /(한대요|한다던데|래요$|라던데|하려고|하려\s*해|하려는|한다고\s*들|하는\s*것\s*같아요|것\s*같아)/;
const RELATION = /(엄마|아빠|부모|어머니|아버지|상사|팀장|사장|남편|아내|남친|여친|남자친구|여자친구|친구|선생|교수|시어머니|장모|애인)/;

// ───── ① 즉시 판정
// V1(🔴): 때림·밀침·세게 잡음·멍·물건을 던짐·벽을 침 — CSO 1-4. "때려치우다"·"멍 때리다"는 제외.
const V1 = [
  /(벽|문|책상|바닥|물건|그릇|휴대폰)을?\s*(세게\s*)?(치|쳐|걷어차|던지|던져|던졌|부수|부쉈|발로\s*차)/,
  /(?<!멍\s{0,2})(때리|때려|때렸|때린)(?!치)|밀치|밀쳤|멱살|목을\s*조르|세게\s*(잡|밀)|발로\s*(차|찼)|걷어찼/,
  /(맞|때|상대|남친|남편|여친|아내|그\s*사람).{0,15}멍\s*(이\s*)?(들|생|났|든)|멍\s*(이\s*)?(들|생|났|든).{0,15}(맞|때|남친|남편|여친|아내|그\s*사람)/,
];
// V2(🔴): 헤어지면 해치겠다·퍼뜨리겠다·죽어 버리겠다·가만 안 두겠다로 붙잡음(상대의 위협).
const V2 = [
  /(헤어지|이별|떠나|그만\s*만나|헤어질).{0,14}(죽어\s*버리|죽겠|죽여|해치|가만\s*안\s*두|퍼뜨리|죽어버)/,
  /가만\s*안\s*두겠|죽여\s*버리겠|죽일\s*거|해칠\s*거|(사진|영상).{0,8}퍼뜨리/,
];
// SAFE-020(🔴): 감시·조종·도청·생각 읽힘을 **본인 일로 확신**. 관계 상대(엄마·상사·남편 등)나 소문·의도 표현이면 해당 없음(일상 말 / 통제 관계는 V3 경로).
const SURV_WORD = /(감시|도청|미행|조종|추적)/;
const FIRST_TARGET = /(저를|나를|저한테|나한테|제\s*(휴대폰|폰|집|방|전화|컴퓨터|머릿속|생각|말|행동)[가-힣]{0,2})/;
const CERTAIN_NOW = /(하고\s*있|당하고\s*있|당해요|당하는|확실|분명|틀림없|하고있)/;
const THOUGHT_READ = /(제|내|저의|나의)\s*(머릿속|생각)(을|이)?.{0,12}(읽고\s*있|읽혀|읽히|주입|심어\s*놓|훔쳐|빼가)/;
export function psychoticCertainty(text: string): boolean {
  if (PAST.test(text) || NON_FIRST.test(text)) return false;
  if (THOUGHT_READ.test(text)) return !HEARSAY.test(text) || /확실|분명/.test(text);
  return SURV_WORD.test(text) && FIRST_TARGET.test(text) && CERTAIN_NOW.test(text) && !RELATION.test(text) && !HEARSAY.test(text);
}
// SAFE-021(🔴): 약을 한꺼번에·한 통 먹었다(지금·방금). 과거·조언 질문("먹어도 되나요")은 해당 없음.
const OVERDOSE = [
  /(방금|지금|아까|조금\s*전|좀\s*전|오늘).{0,20}(약|수면제|진통제|알약|타이레놀|감기약).{0,14}(한꺼번에|한\s*통|한\s*병|다\s*먹|전부\s*먹|몽땅|잔뜩)\s*.{0,4}(먹었|삼켰|털어\s*넣|먹어버)/,
  /(약|수면제|진통제|알약).{0,4}(을|를)?\s*(한꺼번에|한\s*통|한\s*병)\s*(다\s*)?(먹었|삼켰|털어\s*넣|먹어버)/,
];
export function overdoseNow(text: string): boolean {
  return !PAST.test(text) && !NON_FIRST.test(text) && OVERDOSE.some((r) => r.test(text));
}

export function supplementalHits(text: string): InstantHit[] {
  const hits: InstantHit[] = [];
  if (!PAST.test(text) || /(요즘|지금|계속|오늘)/.test(text)) {
    for (const r of V1) { const m = text.match(r); if (m) { hits.push({ ruleId: "SAFE-001", route: "violence", trigger: m[0] }); break; } }
    for (const r of V2) { const m = text.match(r); if (m) { hits.push({ ruleId: "SAFE-001", route: "violence", trigger: m[0] }); break; } }
  }
  if (psychoticCertainty(text)) hits.push({ ruleId: "SAFE-020", route: "crisis", trigger: "감시·조종·생각 읽힘 확신" });
  if (overdoseNow(text)) hits.push({ ruleId: "SAFE-021", route: "crisis", trigger: "약 과다복용" });
  return hits;
}

// ───── ② 답변 지침
export type GuidanceTopic = "eating" | "compulsive_exercise" | "perception" | "substance_dependence" | "drunk_driving" | "heavily_drunk";

const EATING = [
  /(먹고|먹은\s*(걸|거|것)?).{0,8}(토해|토하|토했|구토|게워)|구토를?\s*유도|토하게\s*만|자꾸\s*토해|(설사약|이뇨제|변비약|다이어트\s*약).{0,10}(먹|빼|써|복용)/,
  /(며칠째|사흘째|나흘째|이틀째|일주일째|[3-9]\s*일째|\d{2}\s*일째).{0,12}(굶|안\s*먹|거의\s*못\s*먹|거의\s*안\s*먹|거의\s*못\s*먹었)|굶기를?\s*(반복|계속)|(사흘|나흘|일주일)\s*(내내|동안).{0,6}(굶|안\s*먹)/,
  /폭식.{0,15}(멈출\s*수가?\s*없|멈추질\s*못|괴로|통제가?\s*안)|멈출\s*수가?\s*없.{0,12}(먹|폭식)/,
];
const EXERCISE = [
  /(다쳐도|아파도|다쳤는데|부상.{0,6}(인데|이지만)).{0,14}(운동|러닝|달리|헬스|못\s*쉬|멈출\s*수\s*없|쉬지\s*못|못\s*멈추)/,
  /운동.{0,10}(못\s*하면|안\s*하면).{0,10}(극심한\s*불안|너무\s*불안|죽을\s*것|미칠\s*것)/,
];
const PERCEPTION = [
  /(지금도|계속|요즘|지금).{0,18}(아무도\s*없는데|없는데).{0,14}(목소리|소리)가?\s*(계속\s*)?(들려|들리)/,
  /환청이?\s*(들려|들리|있어|계속)|(없는|실제로\s*없는)\s*(목소리|소리)가?\s*(계속\s*)?(들려|들리)/,
  /(세상|주변|모든\s*게|다)\s*.{0,8}(가짜\s*같|진짜가\s*아닌|비현실)(.{0,14}(무서|괴로|계속|며칠))?/,
];
const DEPENDENCE = [
  /(술|약).{0,6}(없이는|없으면).{0,12}(하루도\s*못|못\s*버|못\s*살|불안|잠을\s*못)/,
  /(술을?\s*)?(끊으면|안\s*마시면|못\s*마시면).{0,12}(손이\s*떨|몸이\s*떨|식은땀|떨려)|손이\s*떨려.{0,12}(술|안\s*마시)/,
  /술.{0,4}(이|을)?\s*(요즘\s*)?(많이\s*)?(늘었|매일\s*마셔|자주\s*마셔|없인)/,
];
const DRUNK_DRIVING = /(술\s*(을\s*)?(마시고|먹고|마신\s*(뒤|후|채))|취한\s*채).{0,8}운전|음주\s*운전/;
const HEAVILY_DRUNK = /(몇\s*병째|너무\s*취했|엄청\s*취했|많이\s*취했|취해서\s*(어지|토|정신)|술에\s*(너무\s*)?취해).{0,20}|술.{0,10}(어지러|토할\s*것|토했)/;

export function detectGuidanceTopics(message: string, recentUserMessages: string[] = []): GuidanceTopic[] {
  const t = message;
  const topics: GuidanceTopic[] = [];
  const sure = !PAST.test(t) && !NON_FIRST.test(t);
  if (sure && EATING.some((r) => r.test(t))) topics.push("eating");
  if (sure && EXERCISE.some((r) => r.test(t))) topics.push("compulsive_exercise");
  if (sure && !psychoticCertainty(t) && PERCEPTION.some((r) => r.test(t))) topics.push("perception");
  if (sure && DEPENDENCE.some((r) => r.test(t))) topics.push("substance_dependence");
  if (DRUNK_DRIVING.test(t) && !NON_FIRST.test(t)) topics.push("drunk_driving");
  if (sure && HEAVILY_DRUNK.test(t) && !topics.includes("substance_dependence")) topics.push("heavily_drunk");
  void recentUserMessages;
  return topics;
}

// 현실감·지각 이야기가 이 대화에서 2번 이상 나왔는지(분명하고 여러 차례일 때만 진료 안내 — CSO SAFE-020).
export function perceptionRepeated(message: string, recentUserMessages: string[]): boolean {
  return [message, ...recentUserMessages].filter((m) => detectGuidanceTopics(m).includes("perception")).length >= 2;
}

// 이 주제가 있으면 이번 턴에는 이론 탐색·선택지 카드·가설 말하기·실천 추천을 열지 않는다(CSO: "이론 탐색·실천 추천을 멈춘다").
export const SUPPRESS_OFFERS: readonly GuidanceTopic[] = ["eating", "perception", "heavily_drunk"];
// 운영 검토 표시(watch)를 세션에 남길 주제(SAFE-020 "운영 검토 목록", 섭식).
export const WATCH_TOPICS: readonly GuidanceTopic[] = ["eating", "perception"];

const BLOCKS: Record<GuidanceTopic, string> = {
  eating:
    "사용자가 먹은 것을 없애려는 행동이나 며칠째 이어지는 굶기를 말했습니다. 이론 탐색·선택지·실천 추천을 하지 말고, 먼저 걱정을 전하세요(예: '몸이 많이 상할 수 있어서 걱정돼요'). 그다음 의사나 섭식 문제를 다루는 전문기관 같은 의료·전문 도움을 안내하세요. 횟수·식사량·체중 같은 숫자를 캐묻지 말고 진단명을 붙이지 마세요. 휴먼 웰니스 세션을 권하지 마세요.",
  compulsive_exercise:
    "다치거나 아파도 운동을 멈추지 못한다는 말이 나왔습니다. 대화는 평소처럼 이어가되 '몸이 회복할 시간도 운동의 일부예요'처럼 무리하지 않도록 한 줄 안내를 더하세요. 이번 답변에서는 운동 실천을 새로 권하지 마세요.",
  perception:
    "현실감이나 지각(들리는 소리, 세상이 가짜 같은 느낌 등)에 관한 말이 나왔습니다. 너무 힘들 때도 나올 수 있는 이야기라서 한 번의 말로 판단하지 마세요. 증상을 캐묻거나 진단명을 말하지 말고, 지금 어떤 상태인지 부드럽게 한 번 물으세요(예: '언제부터, 지금도 그런지 알려주실 수 있을까요?'). 이론 탐색·실천 추천은 하지 마세요. 휴먼 웰니스 세션을 권하지 마세요.",
  substance_dependence:
    "사용자가 술이나 약에 기대 버틴다고 말했습니다. 훈계하지 말고, 조금씩 줄여가는 쪽으로 부드럽게 제안하세요. 손 떨림 같은 몸 증상이 있으면 갑자기 끊기보다 의사와 상의하도록 안내하세요. 진단명을 붙이지 마세요. 처방약 시작·중단·용량 질문이면 의사나 약사와 상의하도록 안내하세요.",
  drunk_driving:
    "술을 마시고 운전한 이야기가 나왔습니다. 음주운전은 하지 않도록 짧고 분명하게 말하세요(훈계가 아니라 안전 안내). '끝내고 싶다' 같은 말이 붙어 있어도 무엇을 끝내고 싶은 것인지 먼저 물으세요 — 자해로 단정하지 마세요. 삶을 끝내는 뜻이라고 사용자가 말하면 그때 위기 안내로 전환됩니다.",
  heavily_drunk:
    "많이 취했다는 말입니다. 과음으로 단정하거나 훈계하지 말고, 먼저 지금 상태(혼자 있는지, 어지러운지, 구토가 있는지)를 물으세요. 의식이 흐리거나 반복해서 토하거나 숨이 이상하다고 하면 119 응급 안내를 하세요. 이론 탐색·실천 추천은 하지 마세요.",
};
const PERCEPTION_REPEAT =
  " 이번 대화에서 이런 이야기가 여러 차례 이어지고 있으므로, 정신건강의학과나 지역 정신건강복지센터를 찾아보도록 한 번 부드럽게 권하세요.";

export function guidanceBlock(topics: GuidanceTopic[], opts: { perceptionRepeated?: boolean } = {}): string | null {
  if (!topics.length) return null;
  return topics.map((t) => `- ${BLOCKS[t]}${t === "perception" && opts.perceptionRepeated ? PERCEPTION_REPEAT : ""}`).join("\n");
}

// 음주운전 이야기를 AI 분류기가 폭력·위기로 잘못 보내는 경우(실측 2026-10-23: "술 마시고 운전했어요" → violence 고정 응답)를 일반 대화로 되돌린다.
// 상담사님: "술 마시고 운전한 건 자해가 아니라 도덕적으로 잘못한 것 — 앞으로 하지 말라고 안내". 조건을 **모두** 만족할 때만: ① 키워드 판정 없이 분류기만 위기·폭력으로 봤고
// ② 음주운전 이야기이며 ③ 자살·자해 의사가 분명한 말(자살·자해·죽고 싶다 등)과 폭력 즉시 판정 패턴이 없음. "끝내고 싶다"만 붙은 경우는 일반 대화에서 "무엇을 끝내고 싶은지" 먼저 묻는다(CSO).
const CLEAR_SELF_HARM = /(자살|자해|죽고\s*싶|죽을\s*것\s*같|죽어\s*버|죽을래|죽으려|사라지고\s*싶|살\s*이유|살기\s*싫|극단|목숨을\s*끊|삶을\s*끊|생을\s*마감)/;
export function canSoftenDrunkDriving(d: { route: string; source: string; classifierUnavailable: boolean }, message: string): boolean {
  return (
    (d.route === "crisis" || d.route === "violence") && d.source === "classifier" && !d.classifierUnavailable &&
    DRUNK_DRIVING.test(message) && !NON_FIRST.test(message) && !CLEAR_SELF_HARM.test(message) && supplementalHits(message).length === 0
  );
}
