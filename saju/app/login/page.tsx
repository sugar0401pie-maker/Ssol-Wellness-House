import Link from "next/link";
import { uiCopy } from "@/lib/engine";
import { safeNext } from "@/lib/validate";

// /login?next=… — 로그인 자리(아직 연결 전).
// 연결할 때: 쏘웰라(app.ssolwellnesshouse.com)와 같은 Supabase 계정을 쓰고, 세션 쿠키 도메인을 .ssolwellnesshouse.com으로 맞추면
// 두 앱이 로그인을 나눠 쓴다(메인 저장소 lib/supabase/shared-cookie-domain.ts와 같은 방식).
export const metadata = { robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const c = uiCopy();
  return (
    <div className="pg">
      <h2>{c.intro.login}</h2>
      <p>{c.save.login_nudge_save}</p>
      <p className="hint">로그인 연결 준비 중이에요.</p>
      <Link className="btn ghost" href={safeNext(next, "/")} style={{ textAlign: "center", textDecoration: "none" }}>
        ←
      </Link>
    </div>
  );
}
