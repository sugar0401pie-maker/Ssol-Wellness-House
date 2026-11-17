import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBearer } from "@/lib/supabase/bearer";
import { adminEmails, isAdminUser } from "./config.ts";
import { ADMIN_SESSION_MINUTES, deriveAdminSecret, issueAdminToken, verifyAdminToken } from "./token.ts";

// 관리자 API가 공통으로 거치는 문. 두 단계를 모두 통과해야 자료가 열린다(둘 다 서버에서 확인):
//  ① 로그인한 계정이 관리자(지정 이메일 + 카카오 가입 계정)인지 — 토큰을 인증 서버에 직접 확인한다(요청마다).
//  ② 관리자 암호를 맞춘 뒤 발급된 표(쿠키)가 유효한지(30분). 암호는 서버 환경변수 ADMIN_PASSWORD에만 있다.
// 관리자 암호가 서버에 설정돼 있지 않으면 어떤 경우에도 열리지 않는다(안전 쪽).
export const ADMIN_COOKIE = "ssol_admin";

export type AdminCtx = { userId: string; email: string };
type Gate = { ok: true; admin: AdminCtx } | { ok: false; res: NextResponse };

const deny = (status: number, error: string, code?: string) => ({ ok: false as const, res: NextResponse.json({ error, ...(code ? { code } : {}) }, { status }) });

function secret(): string {
  return deriveAdminSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.ADMIN_PASSWORD);
}

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export const clientIp = (req: Request): string | null => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

export async function requireAdmin(req: Request, opts: { password?: boolean } = {}): Promise<Gate> {
  const needPassword = opts.password !== false;
  const token = extractBearer(req.headers.get("authorization"));
  if (!token) return deny(401, "로그인이 필요해요.", "login_required");

  const { data, error } = await createAdminClient().auth.getUser(token);
  if (error || !data.user) return deny(401, "로그인이 필요해요.", "login_required");
  if (!isAdminUser(data.user, adminEmails())) return deny(403, "관리자 계정이 아니에요.", "not_admin");

  const admin: AdminCtx = { userId: data.user.id, email: data.user.email ?? "" };
  if (!needPassword) return { ok: true, admin };

  if (!process.env.ADMIN_PASSWORD) return deny(503, "관리자 암호가 서버에 설정되지 않았어요(ADMIN_PASSWORD).", "password_not_configured");
  if (!verifyAdminToken(readCookie(req.headers.get("cookie"), ADMIN_COOKIE), admin.userId, secret())) return deny(401, "관리자 암호를 입력해 주세요.", "password_required");
  return { ok: true, admin };
}

export function setAdminCookie(res: NextResponse, userId: string): void {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: issueAdminToken(userId, secret()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin", // 관리자 API에만 따라간다
    maxAge: ADMIN_SESSION_MINUTES * 60,
  });
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set({ name: ADMIN_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 0 });
}

// 화면이 "암호를 이미 입력했는지"만 알고 싶을 때(자료는 열지 않는다).
export function hasValidAdminCookie(req: Request, userId: string): boolean {
  return !!process.env.ADMIN_PASSWORD && verifyAdminToken(readCookie(req.headers.get("cookie"), ADMIN_COOKIE), userId, secret());
}

// 종합 내보내기의 이용자 코드용 비밀. 관리자 암호를 바꿔도 같은 사람의 코드가 달라지지 않게 서비스 키에서만 만든다.
export function adminSecretForCodes(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createHash("sha256").update(`pseudonym|${key}`).digest("hex") : "";
}

// 내려받기 응답 머리글. 파일 이름은 영문·숫자만(브라우저·운영체제별 한글 이름 깨짐 방지).
export function fileResponse(buf: Buffer, filename: string, contentType: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), { status: 200, headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}

// ───── 열람 기록(admin_access_log) ─────
export async function logAdminAction(admin: AdminCtx, action: string, p: { targetUserId?: string | null; detail?: Record<string, unknown>; ip?: string | null } = {}): Promise<boolean> {
  const { error } = await createAdminClient().from("admin_access_log").insert({
    admin_user_id: admin.userId,
    action,
    target_user_id: p.targetUserId ?? null,
    detail: p.detail ?? {},
    ip: p.ip ?? null,
  });
  if (error) console.error("[admin] 열람 기록 저장 실패:", error.message);
  return !error;
}

// 자료를 내보내기 전에 기록부터 남긴다. 기록이 안 남으면 자료를 내주지 않는다(약관 예고문의 "열람 기록" 약속).
export async function auditOrBlock(admin: AdminCtx, action: string, p: Parameters<typeof logAdminAction>[2]): Promise<NextResponse | null> {
  const ok = await logAdminAction(admin, action, p);
  return ok ? null : NextResponse.json({ error: "열람 기록을 남기지 못해 자료를 내주지 않았어요. 마이그레이션(20261117000000_admin_access_log.sql)이 실행됐는지 확인해 주세요.", code: "audit_unavailable" }, { status: 503 });
}

// 암호 5번 틀리면 15분 잠금. 기록 표를 못 읽으면 이 서버 프로세스 안의 횟수로 대신 센다.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;
const memoryFails = new Map<string, number[]>();

export async function isLockedOut(admin: AdminCtx): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await createAdminClient().from("admin_access_log").select("id", { count: "exact", head: true }).eq("admin_user_id", admin.userId).eq("action", "login_fail").gte("created_at", since);
  const mem = (memoryFails.get(admin.userId) ?? []).filter((t) => t > Date.now() - WINDOW_MS);
  return Math.max(error ? 0 : (count ?? 0), mem.length) >= MAX_FAILS;
}

export function rememberFailure(admin: AdminCtx): void {
  const list = (memoryFails.get(admin.userId) ?? []).filter((t) => t > Date.now() - WINDOW_MS);
  list.push(Date.now());
  memoryFails.set(admin.userId, list);
}
