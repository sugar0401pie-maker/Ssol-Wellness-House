import { redirect } from "next/navigation";

// 2026-09-28 owner 요청: 홈 탭의 실제 주소를 "/"가 아니라 "/home"으로 분리한다. 이 페이지는
// AuthGate가 "로그인된" 사용자에게만 렌더링하므로(로그아웃 상태면 AuthGate가 이 대신
// LandingScreen을 보여준다), 로그인된 사용자가 "/"로 들어오면 곧바로 "/home"으로 보낸다.
export default function RootRedirect() {
  redirect("/home");
}
