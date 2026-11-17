// 관리자 암호를 맞춘 뒤 발급하는 "잠깐 열어 두는" 표(쿠키 값). 순수 함수 — 시험 가능.
// 형식: <사용자 id>.<만료시각(ms)>.<서명>. 서명은 서버만 아는 비밀로 HMAC-SHA256을 건 값이라 값을 바꾸면 틀어진다.
// 로그인한 관리자 본인의 id가 들어 있어서, 다른 계정으로 바꿔 로그인하면 이 표는 쓸 수 없다.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_MINUTES = 30; // 이 시간이 지나면 암호를 다시 묻는다.

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

export function issueAdminToken(userId: string, secret: string, now = Date.now(), minutes = ADMIN_SESSION_MINUTES): string {
  const payload = `${userId}.${now + minutes * 60_000}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyAdminToken(token: string | null | undefined, userId: string, secret: string, now = Date.now()): boolean {
  if (!token || !secret || !userId) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, exp, sig] = parts;
  if (uid !== userId || !/^\d+$/.test(exp) || Number(exp) <= now) return false;
  const expected = sign(secret, `${uid}.${exp}`);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// 비밀은 서비스 키와 관리자 암호를 함께 해시해 만든다 — 암호를 바꾸면 이미 발급된 표가 모두 무효가 된다.
export function deriveAdminSecret(serviceKey: string | undefined, password: string | undefined): string {
  if (!serviceKey || !password) return "";
  return createHash("sha256").update(`admin-session|${serviceKey}|${password}`).digest("hex");
}

// 암호 비교: 길이가 달라도 같은 시간이 걸리게 해시한 값끼리 비교한다. 서버에 암호가 설정돼 있지 않으면 항상 거부(안전 쪽).
export function passwordMatches(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
