"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken, getBrowserClient } from "@/lib/supabase/browser";
import AdminBoard from "./AdminBoard";
import { signInWithOAuth, signOut } from "@/lib/supabase/authClient";
import type { Dashboard } from "@/lib/admin/dashboard";
import type { AccountHit } from "@/lib/admin/data";

// 관리자 화면(2026-11-17). 이 파일은 "보여 주기"만 한다 — 누가 들어올 수 있는지는 전부 서버(/api/admin/*)가 정한다.
// 단계: ① 카카오 로그인 → ② 관리자 계정 확인(서버) → ③ 관리자 암호 → ④ 대시보드·내려받기.
// 맨 아래에는 기존 앱처럼 로그인/로그아웃 버튼이 항상 보인다.

type Stage = "checking" | "loggedOut" | "notAdmin" | "needPassword" | "ready" | "error";

const nf = (n: number) => n.toLocaleString("ko-KR");
const won = (n: number) => `${nf(n)}원`;

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
}

async function saveBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AdminApp() {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const checkAdmin = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) { setMessage("설정 오류로 로그인을 사용할 수 없어요."); setStage("error"); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.is_anonymous === true) { setStage("loggedOut"); return; }
    setEmail(data.session.user.email ?? "");
    try {
      const res = await api("/api/admin/me");
      if (res.status === 401) { setStage("loggedOut"); return; }
      if (res.status === 403) { setStage("notAdmin"); return; }
      const body = await res.json();
      if (!res.ok) { setMessage(body.error ?? "확인하지 못했어요."); setStage("error"); return; }
      if (!body.passwordConfigured) { setMessage("서버에 관리자 암호(ADMIN_PASSWORD)가 아직 설정되지 않았어요. Vercel 환경변수에 넣은 뒤 다시 배포해 주세요."); setStage("error"); return; }
      setStage(body.passwordVerified ? "ready" : "needPassword");
    } catch {
      setMessage("네트워크 오류로 확인하지 못했어요.");
      setStage("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 로그인·관리자 확인(표준 데이터 패칭 패턴)
    void checkAdmin();
    const supabase = getBrowserClient();
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void checkAdmin();
    });
    return () => sub.subscription.unsubscribe();
  }, [checkAdmin]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }); // 암호 확인 표도 함께 지운다
    await signOut();
    setEmail("");
    setStage("loggedOut");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-line bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-[15px] font-medium text-navy">쏠 웰니스 하우스 · 관리자</span>
          {stage === "ready" && <span className="text-[12px] text-slate-400">{email}</span>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {stage === "checking" && <p className="py-16 text-center text-[14px] text-slate-500">확인하고 있어요…</p>}
        {stage === "loggedOut" && <LoginCard onError={setMessage} message={message} />}
        {stage === "notAdmin" && (
          <Card title="관리자 계정이 아니에요">
            <p className="text-[14px] leading-6 text-slate-600">지금 로그인한 계정({email || "알 수 없음"})은 관리자로 등록돼 있지 않아요. 관리자 계정으로 다시 로그인해 주세요.</p>
          </Card>
        )}
        {stage === "needPassword" && <PasswordCard onDone={() => setStage("ready")} />}
        {stage === "error" && <Card title="화면을 열 수 없어요"><p className="text-[14px] leading-6 text-slate-600">{message}</p></Card>}
        {stage === "ready" && <Panels onNeedPassword={() => setStage("needPassword")} />}
      </main>

      {/* 기존 앱처럼 하단에 로그인/로그아웃 */}
      <footer className="border-t border-line bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-[12px] text-slate-400">
          <span>{stage === "loggedOut" || stage === "checking" ? "로그아웃 상태예요" : `${email} 로 로그인됨`}</span>
          {stage === "loggedOut" || stage === "checking" ? (
            <button type="button" onClick={() => void signInWithOAuth("kakao", "/admin")} className="underline underline-offset-2">로그인</button>
          ) : (
            <button type="button" onClick={() => void logout()} className="underline underline-offset-2">로그아웃</button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-white p-6">
      <h1 className="mb-3 text-[16px] font-medium text-navy">{title}</h1>
      {children}
    </section>
  );
}

function LoginCard({ onError, message }: { onError: (m: string) => void; message: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card title="관리자 로그인">
      <p className="mb-4 text-[14px] leading-6 text-slate-600">관리자로 등록된 카카오 계정으로 로그인해 주세요. 로그인한 뒤에 관리자 암호를 한 번 더 입력해요.</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await signInWithOAuth("kakao", "/admin");
          if (!r.ok) { onError(r.error ?? "로그인하지 못했어요."); setBusy(false); }
        }}
        className="w-full rounded-[14px] bg-[#FEE500] px-5 py-3 text-[14px] font-medium text-[#191919] disabled:opacity-60"
      >
        카카오로 로그인
      </button>
      {message && <p className="mt-3 text-[13px] text-red-600">{message}</p>}
    </Card>
  );
}

function PasswordCard({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { setPw(""); onDone(); return; }
      setErr(body.error ?? "확인하지 못했어요.");
    } catch {
      setErr("네트워크 오류로 확인하지 못했어요.");
    }
    setBusy(false);
  };
  return (
    <Card title="관리자 암호">
      <p className="mb-4 text-[14px] leading-6 text-slate-600">관리자 계정이 확인됐어요. 암호를 입력해 주세요. 30분이 지나면 다시 물어봐요.</p>
      <input
        type="password"
        autoComplete="off"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void submit(); }}
        placeholder="관리자 암호"
        className="mb-3 w-full rounded-[12px] border border-line px-4 py-3 text-[14px] outline-none focus:border-navy"
      />
      <button type="button" disabled={busy || !pw} onClick={() => void submit()} className="w-full rounded-[14px] bg-navy px-5 py-3 text-[14px] font-medium text-white disabled:opacity-50">
        {busy ? "확인 중…" : "확인"}
      </button>
      {err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}
    </Card>
  );
}

// ───────────── 대시보드 + 내려받기 ─────────────
function Panels({ onNeedPassword }: { onNeedPassword: () => void }) {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashErr, setDashErr] = useState("");

  const load = useCallback(async () => {
    setDashErr("");
    try {
      const res = await api("/api/admin/stats");
      if (res.status === 401) { onNeedPassword(); return; }
      const body = await res.json();
      if (!res.ok) { setDashErr(body.error ?? "불러오지 못했어요."); return; }
      setDash(body as Dashboard);
    } catch {
      setDashErr("네트워크 오류로 불러오지 못했어요.");
    }
  }, [onNeedPassword]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 대시보드 불러오기(표준 데이터 패칭 패턴)
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-8">
      <DashboardView dash={dash} err={dashErr} reload={load} />
      <Downloads onNeedPassword={onNeedPassword} />
      {/* 2026-11-25: 고민 타파 글 쓰기 */}
      <AdminBoard onNeedPassword={onNeedPassword} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-navy";
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className={`mt-1 text-[24px] font-medium ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-4 text-slate-400">{sub}</p>}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-[14px] font-medium text-slate-700">{title}</h2>
      {note && <p className="mb-2 text-[12px] leading-5 text-slate-400">{note}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </section>
  );
}

function DashboardView({ dash, err, reload }: { dash: Dashboard | null; err: string; reload: () => void }) {
  if (err) return <Card title="대시보드"><p className="text-[14px] text-red-600">{err}</p><button type="button" onClick={reload} className="mt-3 text-[13px] text-navy underline">다시 불러오기</button></Card>;
  if (!dash) return <p className="py-10 text-center text-[14px] text-slate-500">대시보드를 불러오고 있어요…</p>;
  const { accounts: a, usage: u, payments: p, safety: s, daily } = dash;
  const maxBar = Math.max(1, ...daily.flatMap((d) => [d.signups, d.activeUsers]));
  const asOf = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(dash.asOf));
  const planName: Record<string, string> = { monthly: "1개월", quarterly: "3개월", annual: "연간", offline_package: "오프라인 패키지" };
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-[18px] font-medium text-navy">대시보드</h1>
        <button type="button" onClick={reload} className="text-[12px] text-slate-500 underline underline-offset-2">새로고침 · {asOf} 기준</button>
      </div>

      <Group title="가입자" note="쏘웰라 가입자 = 앱에서 약관 동의를 마친 사람. 전체 계정은 퀴즈·결제 사이트와 같이 쓰는 계정이라 쏘웰라 가입자 수와 달라요.">
        <Stat label="쏘웰라 가입자" value={nf(a.signedUp)} sub={`전체 실계정 ${nf(a.realAccounts)}`} />
        <Stat label="오늘 가입" value={nf(a.signupsToday)} />
        <Stat label="최근 7일 가입" value={nf(a.signups7d)} />
        <Stat label="최근 30일 가입" value={nf(a.signups30d)} sub={Object.entries(a.byProvider).map(([k, v]) => `${k} ${v}`).join(" · ")} />
      </Group>

      <Group title="사용자" note="대화를 한 번이라도 한 사람 기준(이용자가 보낸 메시지가 있는 계정).">
        <Stat label="대화한 사람(누적)" value={nf(u.chatters)} />
        <Stat label="오늘 활동" value={nf(u.activeToday)} sub="오늘 메시지를 보낸 사람" />
        <Stat label="최근 7일 활동" value={nf(u.active7d)} sub={`30일 ${nf(u.active30d)}`} />
        <Stat label="대화·메시지" value={`${nf(u.sessions)} · ${nf(u.userMessages)}`} sub={`1인당 대화 ${u.avgSessionsPerChatter}개`} />
      </Group>

      <Group title="결제" note="이용권 = 결제 확인된(이용 중·만료) 이용권 기준. 카카오페이·토스 = 자동 결제, 수동 = 계좌이체·오프라인 등 직접 승인. 신청만 하고 결제 전인 건은 세지 않아요.">
        <Stat label="이용권 결제한 사람" value={nf(p.payers)} sub={`카카오페이 ${nf(p.kakaopayPayers)} · 토스 ${nf(p.tossPayers)} · 수동 ${nf(p.manualPayers)}`} />
        <Stat label="현재 이용 중" value={nf(p.activeNow)} sub={`결제 대기(신청만) ${nf(p.pending)}`} />
        <Stat label="이용권 결제 금액" value={won(p.revenue)} sub={Object.entries(p.byPlan).map(([k, v]) => `${planName[k] ?? k} ${v}`).join(" · ")} />
        <Stat label="심층 보고서 구매" value={`${nf(p.reportBuyers)}명`} sub={`${nf(p.reportOrders)}건 · ${won(p.reportRevenue)}`} />
      </Group>

      <Group title="경고(alert)" note="URGENT = 위기·폭력 경로, 스크리닝 중단 등. WATCH = 주의 표시. 시스템이 기록한 표시를 모아 보여 주는 것이며 진단이 아니에요.">
        <Stat label="URGENT 계정" value={nf(s.urgentAccounts)} sub={`대화 ${nf(s.urgentSessions)}개`} tone={s.urgentAccounts ? "red" : undefined} />
        <Stat label="WATCH 계정" value={nf(s.watchAccounts)} sub={`대화 ${nf(s.watchSessions)}개`} tone={s.watchAccounts ? "amber" : undefined} />
      </Group>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[14px] font-medium text-slate-700">최근 14일 (가입 · 활동)</h2>
        <div className="flex items-end gap-1.5" style={{ height: 96 }}>
          {daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${d.day} 가입 ${d.signups} · 활동 ${d.activeUsers}`}>
              <div className="flex w-full items-end gap-0.5" style={{ height: 72 }}>
                <div className="flex-1 rounded-t bg-navy" style={{ height: `${(d.signups / maxBar) * 100}%`, minHeight: d.signups ? 2 : 0 }} />
                <div className="flex-1 rounded-t bg-emerald-400" style={{ height: `${(d.activeUsers / maxBar) * 100}%`, minHeight: d.activeUsers ? 2 : 0 }} />
              </div>
              <span className="text-[9px] text-slate-400">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-navy" />가입 <span className="ml-2 mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400" />활동한 사람</p>
      </section>

      {s.recent.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 text-[14px] font-medium text-slate-700">최근 경고 대화</h2>
          <ul className="divide-y divide-line">
            {s.recent.map((r) => (
              <li key={r.sessionId} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${r.level === "urgent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.level === "urgent" ? "URGENT" : "WATCH"}</span>
                <span className="text-slate-700">{r.email || r.userId.slice(0, 8)}</span>
                <span className="text-slate-400">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(r.startedAt))}</span>
                <span className="text-[12px] text-slate-500">{r.reasons.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ───────────── 내려받기 ─────────────
function Downloads({ onNeedPassword }: { onNeedPassword: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AccountHit[] | null>(null);
  const [picked, setPicked] = useState<AccountHit | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [allFrom, setAllFrom] = useState("");
  const [allTo, setAllTo] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const run = async (key: string, path: string, fallbackName: string) => {
    setBusy(key);
    setMsg("");
    try {
      const res = await api(path);
      if (res.status === 401) { onNeedPassword(); return; }
      if (!res.ok) { const b = await res.json().catch(() => ({})); setMsg(b.error ?? "내려받지 못했어요."); return; }
      await saveBlob(res, fallbackName);
      setMsg("내려받았어요. 열람 기록에 남았어요.");
    } catch {
      setMsg("네트워크 오류로 내려받지 못했어요.");
    } finally {
      setBusy("");
    }
  };

  const search = async () => {
    if (q.trim().length < 2 || busy) return;
    setBusy("search");
    setMsg("");
    setPicked(null);
    try {
      const res = await api(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
      if (res.status === 401) { onNeedPassword(); return; }
      const b = await res.json();
      if (!res.ok) { setMsg(b.error ?? "검색하지 못했어요."); setResults(null); return; }
      setResults(b.results as AccountHit[]);
    } catch {
      setMsg("네트워크 오류로 검색하지 못했어요.");
    } finally {
      setBusy("");
    }
  };

  const qs = (f: string, t: string, extra = "") => `${extra}${f ? `&from=${f}` : ""}${t ? `&to=${t}` : ""}`;
  const input = "rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-navy";

  return (
    <div className="space-y-6">
      <h1 className="text-[18px] font-medium text-navy">대화 내려받기</h1>
      <p className="-mt-3 rounded-xl bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700">
        이용자의 대화 원문이 들어 있는 자료예요. 내부 라운드테이블 검토 용도로만 쓰고 외부에 공유하지 않아요. 내려받을 때마다 열람 기록이 남아요.
      </p>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-1 text-[15px] font-medium text-slate-800">계정별 대화·보고서</h2>
        <p className="mb-3 text-[12px] leading-5 text-slate-500">이메일, 이름, 닉네임의 일부나 이용자 코드(U-XXXXXXXX — 전체 종합·검토 엑셀에 나오는 코드)를 입력하면 계정을 찾아요.</p>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void search(); }} placeholder="이메일 / 이름 / 닉네임 / U-코드" className={`${input} flex-1`} />
          <button type="button" onClick={() => void search()} disabled={busy === "search" || q.trim().length < 2} className="rounded-[10px] bg-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{busy === "search" ? "찾는 중…" : "검색"}</button>
        </div>

        {results && results.length === 0 && <p className="mt-3 text-[13px] text-slate-500">일치하는 계정이 없어요.</p>}
        {results && results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.userId}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-[13px] ${picked?.userId === r.userId ? "border-navy bg-navy-soft" : "border-line"}`}>
                  <input type="radio" name="account" checked={picked?.userId === r.userId} onChange={() => setPicked(r)} className="mt-1" />
                  <span className="flex-1">
                    <span className="font-medium text-slate-800">{r.name || "(이름 없음)"}{r.nickname ? ` · ${r.nickname}` : ""}</span>
                    {r.alert && <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${r.alert === "urgent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.alert === "urgent" ? "URGENT" : "WATCH"}</span>}
                    <br />
                    <span className="text-slate-500">{r.email} · {r.provider}{r.code ? ` · ${r.code}` : ""}</span>
                    <br />
                    <span className={r.payment.paid ? "font-medium text-emerald-700" : "text-slate-500"}>{r.payment.paid ? "결제함 · " : ""}{r.payment.label}</span>
                    <br />
                    <span className="text-slate-400">가입 {r.createdAt.slice(0, 10)} · 대화 {r.sessions}개 · 메시지 {r.messages}개{r.lastMessageAt ? ` · 마지막 ${r.lastMessageAt.slice(0, 10)}` : ""}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {picked && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="mb-1 text-[13px] font-medium text-slate-700">선택: {picked.name || picked.email}</p>
            <p className="mb-2 text-[12px] text-slate-500">결제: {picked.payment.label}</p>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
              <span>기간</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} aria-label="시작 날짜" />
              <span>~</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} aria-label="끝 날짜" />
              <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-[12px] text-slate-400 underline">비우기</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">비워 두면 가입부터 오늘까지 쌓인 대화 전체예요(한국 시간 기준).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => void run("acct", `/api/admin/export/account?userId=${picked.userId}${qs(from, to)}`, "ssowella-chats.xlsx")} className="rounded-[10px] bg-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
                {busy === "acct" ? "만드는 중…" : "대화 원문 받기 (xlsx)"}
              </button>
              <button type="button" disabled={!!busy} onClick={() => void run("report", `/api/admin/export/report?userId=${picked.userId}${qs(from, to)}`, "ssowella-report.docx")} className="rounded-[10px] border border-navy px-4 py-2 text-[13px] font-medium text-navy disabled:opacity-50">
                {busy === "report" ? "AI 평가 작성 중… (1~2분)" : "이용 보고서 받기 (docx)"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-400">이용 보고서에는 사용한 이론, 경고(watch·urgent) 표시, 대화 원문과 쏘웰라 AI 평가가 들어가요. AI 평가를 만들려고 이 계정의 대화 글이 AI 제공사(OpenAI)로 전송돼요(채팅과 같은 경로). 평가는 진단이 아니며 내부 검토용 메모예요.</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-1 text-[15px] font-medium text-slate-800">전체 대화 종합 (라운드테이블 검토용)</h2>
        <p className="mb-3 text-[12px] leading-5 text-slate-500">
          모든 이용자의 대화를 한 파일(xlsx)로 받아요. 이용자는 코드(U-XXXXXXXX)로만 표시하고, 글 속 전화번호·이메일과 질병명·진단·약 같은 건강 직접 표현은 가려요. 서비스·AI 품질 개선 활용을 거부한 이용자는 빠져요.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
          <span>기간</span>
          <input type="date" value={allFrom} onChange={(e) => setAllFrom(e.target.value)} className={input} aria-label="시작 날짜" />
          <span>~</span>
          <input type="date" value={allTo} onChange={(e) => setAllTo(e.target.value)} className={input} aria-label="끝 날짜" />
          <button type="button" onClick={() => { setAllFrom(""); setAllTo(""); }} className="text-[12px] text-slate-400 underline">비우기</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">비워 두면 서비스 시작부터 오늘까지 전체예요.</p>
        <button type="button" disabled={!!busy} onClick={() => void run("all", `/api/admin/export/all?${qs(allFrom, allTo).replace(/^&/, "")}`, "ssowella-all-chats.xlsx")} className="mt-3 rounded-[10px] bg-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
          {busy === "all" ? "만드는 중…" : "전체 대화 종합 받기 (xlsx)"}
        </button>
      </section>

      {msg && <p className="text-[13px] text-slate-600">{msg}</p>}
    </div>
  );
}
