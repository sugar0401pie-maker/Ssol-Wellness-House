"use client";

import { usePathname } from "next/navigation";
import MyPageTab from "./MyPageTab";
import { panelFromPath } from "@/lib/mypage/panels";

// 마이페이지 틀(app/(app)/mypage/layout.tsx): 마이페이지와 그 위에 뜨는 팝업 주소(/mypage/feedback · /mypage/info …)에서
// 마이페이지를 한 번만 그려 두고 주소에 맞는 팝업만 바꿔 띄운다(팝업을 열고 닫아도 다시 불러오지 않음). /mypage/insights는 따로 된 화면이라 그 화면만.
export default function MyPageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/mypage/insights")) return <>{children}</>;
  return <MyPageTab panel={panelFromPath(pathname)} />;
}
