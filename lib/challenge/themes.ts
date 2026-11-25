import { sparkleFor } from "./sparkles.ts";

// 작심삼일 챌린지의 3일 행동·1주일·1달 해결책(요청문 v1.9.4 3-2장 시안 예시 3가지).
// 2026-11-25 대표님: 마음 이름이 반직관적이라 쉬운 말로 바꿈(예전: 걱정이 계속 돌아요 / 자꾸 미루게 돼요 / 기운이 바닥이에요).
// 실제 서비스에서는 테스트 결과의 기저 생각(마음의 뿌리)마다 따로 써야 하고, 나머지 문안은 기획(CSO)이 전달할 예정이다.
// 테스트 사이트의 결과 마지막 화면이 /challenge?theme=<key>로 보내면 그 마음이 미리 골라진다.
// proof: 그날 남겨 볼 것(대표님 2026-11-25 — "인증샷 아이디어"라는 말 대신 하는 말로, 끝에 별가루 기호 — lib/challenge/sparkles.ts).
export type ChallengeDay = { action: string; proof: string };
export type ChallengeTheme = { key: string; label: string; days: [ChallengeDay, ChallengeDay, ChallengeDay]; week: string; month: string };

export const CHALLENGE_THEMES: ChallengeTheme[] = [
  {
    key: "worry",
    label: "걱정이 머릿속을 떠나지 않아요",
    days: [
      { action: "걱정 3개를 종이에 적어 보기", proof: "걱정을 적은 종이를 쓰레기통에 버려 보기" },
      { action: "10분 걷고 하늘 사진 찍기", proof: "걷다가 만난 하늘 사진 찍어 보기" },
      { action: "내일 할 일 딱 하나만 정해 적기", proof: "내일 할 일 한 줄을 적은 메모 찍어 보기" },
    ],
    week: "매일 밤 걱정을 한 줄만 적고 내일의 나에게 넘기기, 7일 이어 가기",
    month: "걱정 적는 시간을 저녁 10분으로 정해 두고, 한 달 뒤 기록을 모아 보기",
  },
  {
    key: "delay",
    label: "할 일을 자꾸 미뤄요",
    days: [
      { action: "미루던 일 하나를 5분만 해 보기", proof: "5분 타이머를 켠 화면 찍어 보기" },
      { action: "책상 위 한 칸만 치우기", proof: "깨끗해진 책상 한 칸 찍어 보기" },
      { action: "오늘 끝낸 일 3개 체크하기", proof: "체크한 목록 찍어 보기" },
    ],
    week: "하루 하나, 5분짜리 일을 7일 이어 가기",
    month: "미루는 일 하나를 정해서 4주에 걸쳐 잘게 쪼개 끝내 보기",
  },
  {
    key: "energy",
    label: "몸도 마음도 기운이 없어요",
    days: [
      { action: "물 한 컵 마시고 창문 열기", proof: "물컵이나 창밖 풍경 찍어 보기" },
      { action: "좋아하는 노래 한 곡에 맞춰 5분 스트레칭", proof: "오늘의 노래 화면 찍어 보기" },
      { action: "오늘 먹은 것 중 제일 맛있는 것 찍기", proof: "오늘의 한 끼 찍어 보기" },
    ],
    week: "매일 같은 시간에 햇빛 쬐며 5분 걷기, 7일 이어 가기",
    month: "자기 전 스트레칭처럼 나를 챙기는 작은 루틴 하나를 한 달 이어 가기",
  },
];

export const DEFAULT_THEME = CHALLENGE_THEMES[0].key;
export const themeOf = (key: string | null | undefined): ChallengeTheme => CHALLENGE_THEMES.find((t) => t.key === key) ?? CHALLENGE_THEMES[0];
export const isThemeKey = (key: unknown): key is string => typeof key === "string" && CHALLENGE_THEMES.some((t) => t.key === key);

// 그날 남겨 볼 것 + 별가루(마음·일차마다 정해진 하나).
export const proofLine = (themeKey: string, dayIndex: number): string => {
  const t = themeOf(themeKey);
  const i = CHALLENGE_THEMES.indexOf(t);
  return `${t.days[dayIndex].proof} ${sparkleFor(i * 3 + dayIndex + 32)}`;
};
