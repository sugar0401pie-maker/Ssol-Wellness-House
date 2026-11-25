// 마이페이지 팝업마다 주소(대표님 2026-11-25 "마이페이지 팝업도 다 주소 나눠줘"):
// 고객의 의견 /mypage/feedback · 비밀번호 확인 /mypage/info/verify · 내 정보 수정 /mypage/info · 회원 탈퇴 /mypage/info/withdraw.
// 팝업은 마이페이지 위에 그대로 뜨고(뒤 화면은 그대로), 주소만 다르다. 브라우저·테스트 모두 쓰므로 "server-only"를 넣지 않는다.
export type MyPagePanel = "feedback" | "verify" | "info" | "withdraw";

export const MYPAGE_PANEL_PATH: Record<MyPagePanel, string> = {
  feedback: "/mypage/feedback",
  verify: "/mypage/info/verify",
  info: "/mypage/info",
  withdraw: "/mypage/info/withdraw",
};

export function panelFromPath(pathname: string): MyPagePanel | null {
  const p = pathname.replace(/\/+$/, "");
  for (const [k, v] of Object.entries(MYPAGE_PANEL_PATH)) if (p === v) return k as MyPagePanel;
  return null;
}

// 비밀번호를 다시 확인한 지 얼마 안 됐는지(이 탭에서만, 10분). 정보 수정·탈퇴 주소로 바로 들어오면 이걸 보고 확인 화면으로 보낸다.
export const VERIFY_TTL_MS = 10 * 60 * 1000;
export const isVerifiedRecently = (at: number | null, now: number): boolean => at != null && now - at >= 0 && now - at < VERIFY_TTL_MS;
