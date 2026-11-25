import MyPageShell from "@/components/app/MyPageShell";

// 마이페이지와 팝업 주소들이 같이 쓰는 틀 — components/app/MyPageShell.tsx
export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  return <MyPageShell>{children}</MyPageShell>;
}
