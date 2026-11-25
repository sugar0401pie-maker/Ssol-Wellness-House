import { redirect } from "next/navigation";

// 2026-09-28 owner 요청: 홈 탭의 실제 주소를 "/"가 아니라 "/home"으로 분리한다. 이 페이지는
// AuthGate가 "로그인된" 사용자에게만 렌더링하므로(로그아웃 상태면 AuthGate가 이 대신
// LandingScreen을 보여준다), 로그인된 사용자가 "/"로 들어오면 곧바로 "/home"으로 보낸다.
// 2026-11-25(요청문 v1.9.4 8-3장): "/"로 들어온 것만 표시(?entry=1)해 두고, 홈이 그날 첫 접속이면 풍등 화면으로 먼저 보낸다(LanternBanner).
// 다른 주소(/home·/chat·/pricing 등)로 직접 들어오면 이동하지 않는다.
export default function RootRedirect() {
  redirect("/home?entry=1");
}
