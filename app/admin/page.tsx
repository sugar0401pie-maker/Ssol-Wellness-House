import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

// 2026-11-17 관리자 페이지. 검색엔진에 올라가지 않게 하고(noindex), 사이트맵·소개 링크에도 넣지 않는다.
// 이 화면은 껍데기일 뿐이고, 모든 자료는 /api/admin/* 가 "관리자 계정(카카오) + 관리자 암호"를 서버에서 확인한 뒤에만 준다.
export const metadata: Metadata = {
  title: "관리자 | 쏠 웰니스 하우스",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return <AdminApp />;
}
