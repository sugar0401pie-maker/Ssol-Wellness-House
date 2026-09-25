// SSOL_Onboarding_Development_Spec_v1_0 (2026-09-25) 그대로 옮긴 온보딩 9문항 설정.
// 브라우저(모달 렌더링)와 서버(검증) 양쪽에서 쓰므로 "server-only"는 넣지 않는다.
// 문구·선택지·순서는 스펙 문서와 questions.json 원문을 그대로 따른다 — 임의로 다듬지 않는다.

export type OptionType = "single" | "multi" | "ranked";

export type QuestionOption = readonly [code: string, label: string];

export type QuestionDef = {
  id: string;
  title: string;
  type: OptionType;
  required: boolean;
  options: readonly QuestionOption[];
  maxSelect?: number; // multi 전용
  minSelect?: number; // ranked 전용(기본 1)
  maxRank?: number; // ranked 전용(기본 3)
  exclusive?: readonly string[]; // 이 옵션들은 다른 선택과 동시 선택 불가
  branches?: readonly BranchDef[];
};

export type BranchDef = {
  when: string | readonly string[]; // 부모 답변이 이 값(들) 중 하나면 노출
  id: string;
  title: string;
  type: OptionType;
  options: readonly QuestionOption[];
};

export const OTHER_CODE = "other";
export const OTHER_MIN_CHARS = 10;
export const OTHER_MAX_CHARS = 200;

export const PHASE_LABELS = ["나의 현재 생활", "내가 좋아하고 중요하게 생각하는 것", "나에게 맞는 작은 변화"] as const;

// 각 질문이 속한 단계(0-indexed) — STEP1: Q1~3, STEP2: Q4~6, STEP3: Q7~9
export function phaseOf(stepIndex: number): number {
  if (stepIndex <= 2) return 0;
  if (stepIndex <= 5) return 1;
  return 2;
}

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "relationship_status",
    title: "현재 연애나 동반자 관계는 어떤 상태인가요?",
    type: "single",
    required: false,
    options: [
      ["no_partner", "현재 연인이나 배우자가 없어요"],
      ["has_partner", "현재 연인이나 배우자가 있어요"],
      ["transition", "현재 이별이나 별거 등 관계의 변화를 겪고 있어요"],
      ["prefer_not", "답하고 싶지 않아요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
    branches: [
      {
        when: "no_partner",
        id: "dating_interest",
        title: "앞으로 연애할 마음은 어떤가요?",
        type: "single",
        options: [
          ["not_interested", "연애에 관심이 없어요"],
          ["open_to_dating", "좋은 사람을 만난다면 연애하고 싶어요"],
          ["actively_looking", "적극적으로 연애 상대를 찾고 있어요"],
          ["unsure", "아직 잘 모르겠어요"],
          [OTHER_CODE, "기타 (직접 입력)"],
        ],
      },
      {
        when: "has_partner",
        id: "relationship_stage",
        title: "현재 관계를 조금 더 알려주세요.",
        type: "single",
        options: [
          ["dating_no_marriage_plan", "교제 중이며 당장 결혼이나 동거 계획은 없어요"],
          ["preparing_marriage_or_cohabitation", "결혼이나 동거를 준비하고 있어요"],
          ["cohabiting", "동거 중이에요"],
          ["married", "결혼해서 함께 살고 있어요"],
          [OTHER_CODE, "기타 (직접 입력)"],
        ],
      },
    ],
  },
  {
    id: "childcare_status",
    title: "현재 자녀를 양육하거나 정기적으로 돌보고 있나요?",
    type: "single",
    required: false,
    options: [
      ["raising_child", "현재 양육하거나 돌보는 자녀가 있어요"],
      ["regular_caregiver", "자녀는 없지만 정기적으로 돌보는 아이가 있어요"],
      ["planning", "현재는 없지만 앞으로 자녀를 계획하고 있어요"],
      ["none", "현재는 없고 당분간 계획도 없어요"],
      ["prefer_not", "답하고 싶지 않아요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
    branches: [
      {
        when: ["raising_child", "regular_caregiver"],
        id: "child_age_groups",
        title: "돌보는 아이의 연령대는 어떻게 되나요?",
        type: "multi",
        options: [
          ["age_0_2", "0~2세"],
          ["age_3_6", "3~6세"],
          ["age_7_12", "7~12세"],
          ["age_13_18", "13~18세"],
          ["adult_child", "성인 자녀"],
          [OTHER_CODE, "기타 (직접 입력)"],
        ],
      },
    ],
  },
  {
    id: "primary_activity",
    title: "현재 일상에서 가장 많은 시간을 보내는 활동은 무엇인가요?",
    type: "single",
    required: false,
    options: [
      ["full_time", "회사나 기관에서 풀타임으로 일하고 있어요"],
      ["part_time", "파트타임으로 일하고 있어요"],
      ["freelance", "프리랜서나 자영업으로 일하고 있어요"],
      ["student", "학생이에요"],
      ["job_seeking", "취업이나 이직을 준비하고 있어요"],
      ["caregiving", "육아나 가족 돌봄에 집중하고 있어요"],
      ["leave_or_break", "휴직하거나 잠시 쉬고 있어요"],
      ["retired", "은퇴했어요"],
      ["prefer_not", "답하고 싶지 않아요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "values_ranked",
    title: "지금 삶에서 가장 중요하게 생각하는 것은 무엇인가요?",
    type: "ranked",
    required: false,
    minSelect: 1,
    maxRank: 3,
    options: [
      ["career_success", "업무에서 성과를 내고 성공하는 것"],
      ["personal_joy", "일과 후 나만의 즐거움을 찾는 것"],
      ["work_family_balance", "일과 가정의 균형을 이루는 것"],
      ["happy_family", "행복한 가정을 꾸리는 것"],
      ["find_love", "일생일대의 사랑을 찾는 것"],
      ["friendships", "친구들과 좋은 관계를 유지하는 것"],
      ["family_time", "가족들과 즐거운 시간을 보내는 것"],
      ["financial_stability", "경제적으로 안정된 삶을 사는 것"],
      ["physical_mental_health", "몸과 마음의 건강을 유지하는 것"],
      ["learning_growth", "새로운 것을 배우고 성장하는 것"],
      ["life_meaning", "나만의 가치와 삶의 의미를 발견하는 것"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "hobbies_ranked",
    title: "평소 좋아하거나 관심 있는 취미는 무엇인가요?",
    type: "ranked",
    required: false,
    minSelect: 1,
    maxRank: 3,
    exclusive: ["no_hobby_yet"],
    options: [
      ["rest_home", "집에서 편하게 누워 쉬기"],
      ["meet_friends", "친구들과 만나 수다 떨기"],
      ["solo_running", "혼자 걷거나 달리기"],
      ["group_sports", "사람들과 함께 활동적인 운동하기"],
      ["yoga_pilates", "필라테스나 요가 같은 정적인 운동하기"],
      ["reading_cafe", "혼자 책을 읽거나 카페에서 시간 보내기"],
      ["creative", "요리·사진·그림 같은 창작 활동하기"],
      ["culture", "음악·공연·영화 등 문화생활 즐기기"],
      ["learning", "새로운 것을 배우거나 클래스 참여하기"],
      ["no_hobby_yet", "아직 좋아하는 취미를 찾지 못했어요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "weekends_ranked",
    title: "당신이 생각하는 가장 행복한 주말은 어떤 모습인가요?",
    type: "ranked",
    required: false,
    minSelect: 1,
    maxRank: 3,
    exclusive: ["not_sure"],
    options: [
      ["home_movie", "하루 종일 뒹굴다가 집에서 영화 보기"],
      ["culture_together", "가족·연인·친구와 영화나 공연 보러 가기"],
      ["picnic", "날씨 좋은 날 공원에서 피크닉하기"],
      ["new_restaurant", "집 근처 새로운 맛집 발견하기"],
      ["photos_social", "예쁜 사진을 찍어서 SNS에 공유하기"],
      ["travel_food", "여행을 떠나 새로운 음식을 맛보기"],
      ["favorite_cafe", "자주 가는 맛집이나 디저트 가게 방문하기"],
      ["solo_hobby", "혼자만의 취미에 온전히 몰입하기"],
      ["outdoors", "산책·등산·운동 등 야외에서 몸 움직이기"],
      ["new_experience", "원데이 클래스나 새로운 체험에 도전하기"],
      ["not_sure", "아직 잘 모르겠어요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "focus_domains",
    title: "요즘 조금 더 나아졌으면 하는 삶의 영역은 무엇인가요?",
    type: "multi",
    required: false,
    maxSelect: 2,
    exclusive: ["none"],
    options: [
      ["self_emotions", "나 자신과 감정"],
      ["human_relationships", "친구·가족·동료와의 인간관계"],
      ["romance", "연애나 배우자와의 관계"],
      ["work_career", "직장생활·업무·진로"],
      ["parenting_care", "육아와 가족 돌봄"],
      ["life_direction", "삶의 방향과 미래"],
      ["joy", "일상의 즐거움과 행복"],
      ["none", "아직 특별히 떠오르는 건 없어요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "daily_time",
    title: "하루에 작은 변화를 위해 어느 정도 시간을 낼 수 있나요?",
    type: "single",
    required: false,
    options: [
      ["under_5", "5분 이내로 가볍게"],
      ["min_10_15", "10~15분 정도"],
      ["min_20_30", "20~30분 정도"],
      ["flexible", "시간이 조금 걸려도 괜찮아요"],
      ["varies", "매일 상황에 따라 달라요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
  {
    id: "excluded_activities",
    title: "매일 추천받고 싶지 않은 제안이 있나요?",
    type: "multi",
    required: false,
    exclusive: ["none"],
    options: [
      ["couple", "연인·배우자와 함께하는 활동"],
      ["child", "아이와 함께하는 활동"],
      ["work", "직장·업무 관련 활동"],
      ["other_people", "누군가에게 연락하거나 만나야 하는 활동"],
      ["exercise", "운동 등 몸을 움직이는 활동"],
      ["mindfulness", "명상·호흡·몸의 감각에 집중하는 활동"],
      ["social_media", "사진을 찍거나 SNS에 공유하는 활동"],
      ["spending", "돈이 드는 활동"],
      ["none", "특별히 제외하고 싶은 것은 없어요"],
      [OTHER_CODE, "기타 (직접 입력)"],
    ],
  },
] as const;

// "기타"가 유효하려면 공백류(스페이스/탭/줄바꿈 등)를 제외한 문자 수가 10자 이상, 200자 이하.
export function isOtherTextValid(text: string): boolean {
  const nonWhitespaceLen = text.replace(/\s/g, "").length;
  return nonWhitespaceLen >= OTHER_MIN_CHARS && text.length <= OTHER_MAX_CHARS;
}

export function nonWhitespaceCount(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function findQuestion(id: string): QuestionDef | BranchDef | undefined {
  for (const q of QUESTIONS) {
    if (q.id === id) return q;
    for (const b of q.branches ?? []) if (b.id === id) return b;
  }
  return undefined;
}
