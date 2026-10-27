// 3단계(2026-10-23, 전문위원·상담사님 R1·R3-1~3 / 대표님 확정): 사별·질병 상황 지침(R3)과 점수·진단·원인 확정 요청(S5) 판단. 순수 함수(네트워크 없음).
// 원칙: 이런 상황도 **일반 사례처럼 해당 이론을 적용해 채팅을 진행**하되, 의학적 판단·내용은 반드시 전문가와 상의하도록 안내한다.
// 복합 애도 의심·자살 유족·정신장애 관련 요청을 **휴먼 웰니스 세션으로 안내하지 않는다**(상담사님). 위기 표현이 나오면 안전 라우터가 먼저 처리하므로 여기서 다루지 않는다.
import { illnessOwner, lossTalk } from "../theory/exclusion.ts";
import { despairBefore, hasDespairTalk } from "./screening.ts";

// ───── R3 지침 블록
const BEREAVEMENT_RECENT =
  "사별·상실 직후로 보이는 이야기입니다(급성기). 공감과 안정화가 먼저입니다: 감정과 욕구를 그대로 받아주고, 해결책·이론 탐색·실천 추천은 이번 답변에서 하지 마세요. 필요할 때만 한 번에 하나씩 부드럽게 물으세요 — 어떤 관계였는지, 요즘 잠·식사·일상은 어떤지, 곁에 힘이 되는 사람이 있는지. 사망 방식은 사용자가 먼저 말할 때만 이어가세요. 복합 애도가 의심되거나 자살로 가족을 잃은 경우에도 휴먼 웰니스 세션으로 안내하지 말고 같은 방식으로 공감하세요. 의학적·임상적 판단(애도 반응이 병적인지 등)은 하지 말고, 일상 기능이 많이 무너졌다면 정신건강 전문가와 상의해보도록 안내하세요.";
const BEREAVEMENT_OLD =
  "오래전 상실에 관한 이야기입니다. 일반적인 애도 과정으로 보이면 평소처럼 대화하고 필요하면 이론 탐색을 이어가도 됩니다. 의학적·임상적 판단은 하지 말고, 괴로움이 크게 이어진다면 정신건강 전문가와 상의해보도록 안내하세요. 휴먼 웰니스 세션을 먼저 권하지 마세요(사용자가 원할 때만).";
const ILLNESS_SELF_FIRST =
  "사용자 본인의 질병 이야기입니다. 신체질환에 대한 의학적 판단·조언, 검사 수치·영상 해석, 약의 효능·부작용 판단, 진단·치료 권유는 하지 마세요. 처음 의학적인 질문이 나왔으므로 이번 답변에서 한 번만 담당 의사 등 의료 전문가와 상의해보도록 부드럽게 안내하세요. 질병 때문에 생긴 마음(불안·두려움·속상함·생활의 변화)은 공감하고, 그 밖의 마음·생활 이야기는 일반 사례처럼 이어가세요. 정신장애에 대한 진단·조언·상담을 원하면 의료기관과 상의하도록 안내하고 휴먼 웰니스 세션으로 안내하지 마세요.";
const ILLNESS_SELF_AGAIN =
  "사용자 본인의 질병 이야기가 이어지고 있습니다. 의학적 판단·조언, 검사 수치·영상 해석, 약 판단은 하지 마세요. 의료 전문가와 상의해보라는 안내는 이미 했으므로 되풀이하지 마세요(새로운 위험 신호가 나올 때만 다시 안내). 질병으로 생긴 마음은 공감하고 그 밖의 이야기는 일반 사례처럼 이어가세요. 정신장애 관련 진단·상담 요청은 의료기관과 상의하도록 하고 휴먼 웰니스 세션으로 안내하지 마세요.";
const ILLNESS_OTHER =
  "가족이나 가까운 사람의 질병 이야기입니다. 그로 인한 불안·슬픔·부담은 일반적인 고민으로 공감하고 타당화하며, 나눌 수 있게 이야기를 이어가세요. 필요하면 일반 사례처럼 이론 탐색을 열 수 있습니다. 병의 상태·치료에 대한 의학적 판단은 하지 말고 담당 의료진과 상의하도록 안내하세요.";

// 의사·의료진과 상의하라는 안내를 이미 했는지(직전 쏘웰라 답변들에서). "한 번만" 규칙(CSO R3-2)용.
const REFERRAL_DONE = /(담당\s*의사|의료진|의사\s*선생님|의사와\s*상의|병원에서|전문가와\s*상의|전문가에게|진료)/;
export const medicalReferralGiven = (recentAssistantTexts: string[]) => recentAssistantTexts.some((t) => REFERRAL_DONE.test(t));

export function situationGuidance(message: string, recentUserMessages: string[], recentAssistantTexts: string[]): string | null {
  const texts = [message, ...recentUserMessages.slice(-2)]; // 이번 메시지 + 직전 두 발화(신호가 한두 턴 이어지도록)
  const parts: string[] = [];
  const loss = texts.map(lossTalk).find((x) => x !== null) ?? null;
  if (loss === "recent") parts.push(BEREAVEMENT_RECENT);
  else if (loss === "old") parts.push(BEREAVEMENT_OLD);
  const owner = texts.map((t) => (t.includes("병문안") ? null : illnessOwner(t))).find((x) => x) ?? null;
  if (owner === "illness_self") parts.push(medicalReferralGiven(recentAssistantTexts) ? ILLNESS_SELF_AGAIN : ILLNESS_SELF_FIRST);
  else if (owner === "illness_other" || owner === "illness_unspecified") parts.push(ILLNESS_OTHER);
  return parts.length ? parts.map((p) => `- ${p}`).join("\n") : null;
}

// ───── S5: 점수·진단·원인 확정 요청(R1). 진단 요청("ADHD인지 진단해줘")은 임상 경로가 처리하므로 일반 대화 경로에서만 쓴다.
const VERDICT = /(점수로\s*(알려|말해)|점수\s*(알려|매겨)|몇\s*점이|판정해|확정해\s*(줘|주세요)|원인이?\s*뭔지\s*(알려|확실)|원인을\s*알려|정확히\s*(알려\s*줘|알려주세요|판단))/;
export const isVerdictRequest = (text: string) => VERDICT.test(text);
export const SESSION_PITCH_MARK = "개인 웰니스 세션"; // S5 두 번째 응답이 이미 나갔는지 알아보는 표시

export type VerdictAction = "none" | "first" | "second" | "repeat";
// 같은 대화 안에서(Q7): 첫 요청이면 first(반영 + 이면의 욕구 질문), 두 번째 요청이면 second(고정 안내), 그 뒤에도 또 하면 repeat(마음 반영만, 세션 안내 되풀이 금지).
export function verdictAction(message: string, recentUserMessages: string[], recentAssistantTexts: string[]): VerdictAction {
  if (!isVerdictRequest(message)) return "none";
  if (recentAssistantTexts.some((t) => t.includes(SESSION_PITCH_MARK) && t.includes("단정"))) return "repeat";
  return recentUserMessages.some(isVerdictRequest) ? "second" : "first";
}

export const VERDICT_FIRST_BLOCK =
  "사용자가 점수·진단·원인을 확정해 달라고 요청했습니다. 점수나 진단, 원인을 단정하지 마세요. ① 사용자의 마음을 한 문장으로 반영하고 ② '혹시 그 질문을 하게 된 마음을 알 수 있을까요?'처럼 이면의 욕구를 한 가지만 물으세요. ③ 짐작되는 욕구가 있으면 한 문장으로 제안형으로 덧붙이세요(예: '내가 왜 이런지 스스로 이해하고 싶은 마음일까요?'). 휴먼 웰니스 세션은 아직 권하지 마세요.";
export const VERDICT_REPEAT_BLOCK =
  "사용자가 점수·진단·원인 확정을 또 요청했습니다. 단정하지 말고, 마음을 한 문장으로 반영한 뒤 지금 가장 궁금한 한 가지를 물으세요. 개인 웰니스 세션 안내는 이미 했으니 되풀이하지 마세요.";

// ───── CSO 결정 13: 절망·포기 표현("다 그만두고 싶어요", "뭘 해도 안 바뀔 거예요")은 처음엔 이유를 먼저 묻는다. 자살·자해라는 말을 AI가 먼저 꺼내지 않는다(질문은 반복될 때 시스템이 고정 문구로).
export const DESPAIR_FIRST_BLOCK =
  "사용자가 '다 그만두고 싶다'거나 '뭘 해도 안 바뀔 것 같다'는 절망·포기의 마음을 말했습니다. 단어만으로 상태를 판단하지 마세요. 마음을 한 문장으로 받아 준 뒤, 왜 그렇게 느끼는지·요즘 어떤 일이 있었는지를 부드럽게 한 가지만 물으세요. 자살·자해·극단적 선택이라는 말을 먼저 꺼내거나 확인하는 질문을 하지 말고, 진단명이나 전문가 상담 권유는 이번 답변에서 하지 마세요. 해결책을 나열하지 마세요.";
export const DESPAIR_AGAIN_BLOCK =
  "사용자가 절망·포기의 마음을 이번 대화에서 또 말했습니다. 이유는 이미 물었으므로 되풀이해서 묻지 말고, 그 마음이 이어지는 것을 알아주세요. 자살·자해라는 말을 먼저 꺼내지 마세요. 해결책은 아직 나열하지 말고 지금 가장 마음에 걸리는 한 가지를 같이 짚어 보자고 제안하세요.";
export function despairGuidance(message: string, recentUserMessages: string[]): string | null {
  if (!hasDespairTalk(message)) return null;
  return `- ${despairBefore(recentUserMessages) ? DESPAIR_AGAIN_BLOCK : DESPAIR_FIRST_BLOCK}`;
}
