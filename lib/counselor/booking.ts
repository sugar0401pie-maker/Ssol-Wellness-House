// 상담사 연결(예약 문의) 폼에 쓰는 고정 목록. ssolwellnesshouse.com의 실제 예약 페이지
// 문구를 그대로 옮겼다(2026-09-25 owner 지정). 브라우저(폼)와 서버(검증) 양쪽에서 쓰므로
// "server-only"는 넣지 않는다.

export type ProgramOption = { id: string; label: string; duration: string; price: string };

export const PROGRAMS: ProgramOption[] = [
  { id: "신규고객 면담", label: "신규고객 면담(75% 할인)", duration: "20분", price: "10,000원" },
  { id: "기존고객 세션예약", label: "기존고객 세션예약", duration: "50분", price: "0원" },
];

// 09:00~09:50 ... 22:00~22:50 (1시간 간격, 상담 자체는 50분).
export const TIME_SLOTS: string[] = Array.from({ length: 14 }, (_, i) => {
  const hour = 9 + i;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}:00 ~ ${pad(hour)}:50`;
});

export const AGE_RANGES = ["10대 이하", "20대", "30대", "40대", "50대", "60대 이상"] as const;
export const GENDER_OPTIONS = ["여성", "남성", "선택 안 함"] as const;
export const REFERRAL_SOURCES = [
  "네이버 블로그",
  "인스타그램",
  "틱톡",
  "네이버 검색",
  "구글 검색",
  "지인 추천",
  "홍보 메일",
  "기타",
] as const;

// 한 번 신청에 고를 수 있는 후보 시간 개수 — 실시간 캘린더 연동 전이라 2~3개를 받아
// 관리자가 확인 후 하나로 확정해 다시 연락한다(owner 지정).
export const MAX_PREFERRED_TIMES = 3;
export const MIN_PREFERRED_TIMES = 2;
