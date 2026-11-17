import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summarizeDashboard, type AuthRow } from "./dashboard.ts";

const now = new Date("2026-11-17T03:00:00Z"); // KST 2026-11-17 12:00
const u = (id: string, createdAt: string, o: Partial<AuthRow> = {}): AuthRow => ({ id, email: `${id}@x.com`, createdAt, lastSignInAt: null, anonymous: false, provider: "email", metaNames: [], ...o });
const msg = (session_id: string, user_id: string, created_at: string, role = "user", route: string | null = "wellness", marker: string | null = null) => ({ session_id, user_id, role, route, reflection_signal_id: marker, created_at });

const base = {
  users: [u("a", "2026-11-17T01:00:00Z"), u("b", "2026-11-12T01:00:00Z", { provider: "kakao" }), u("c", "2026-10-01T01:00:00Z"), u("anon", "2026-11-17T01:00:00Z", { anonymous: true })],
  profiles: [
    { user_id: "a", display_name: "가", nickname: null, terms_agreed_at: "2026-11-17T01:00:00Z", ai_training_consent: true },
    { user_id: "b", display_name: "나", nickname: null, terms_agreed_at: "2026-11-12T01:00:00Z", ai_training_consent: true },
    { user_id: "c", display_name: "다", nickname: null, terms_agreed_at: null, ai_training_consent: true }, // 약관 동의 기록 없음 = 쏘웰라 가입자 아님
  ],
  sessions: [
    { session_id: "s1", user_id: "a", safety_flag: "none", started_at: "2026-11-17T01:10:00Z" },
    { session_id: "s2", user_id: "b", safety_flag: "crisis", started_at: "2026-11-12T02:00:00Z" },
    { session_id: "s3", user_id: "b", safety_flag: "elevated", started_at: "2026-11-13T02:00:00Z" },
    { session_id: "s4", user_id: "anon", safety_flag: "crisis", started_at: "2026-11-17T01:20:00Z" }, // 익명 계정은 센 값에서 빠진다
  ],
  messages: [
    msg("s1", "a", "2026-11-17T01:10:00Z"), msg("s1", "a", "2026-11-17T01:11:00Z", "assistant"),
    msg("s2", "b", "2026-11-12T02:00:00Z"), msg("s2", "b", "2026-11-12T02:01:00Z", "assistant", "crisis"),
    msg("s3", "b", "2026-11-13T02:00:00Z"),
    msg("s4", "anon", "2026-11-17T01:20:00Z"),
  ],
  ents: [
    { user_id: "a", plan: "monthly", status: "active", amount: 2900, expires_at: "2026-12-17T00:00:00Z", toss_payment_key: "pk1" },
    { user_id: "b", plan: "annual", status: "active", amount: 22800, expires_at: null, toss_payment_key: null }, // 수동 승인
    { user_id: "c", plan: "monthly", status: "pending", amount: 2900, expires_at: null, toss_payment_key: null }, // 신청만 — 결제 아님
    { user_id: "c", plan: "monthly", status: "expired", amount: 2900, expires_at: "2026-10-30T00:00:00Z", toss_payment_key: "pk2" },
  ],
  orders: [{ user_id: "a", status: "paid", amount: 9900 }, { user_id: "b", status: "pending", amount: 9900 }, { user_id: null, status: "paid", amount: 9900 }],
  roots: [{ user_id: "a", caution_hold: true, safety2_level: null }],
};

describe("대시보드 계산", () => {
  const d = summarizeDashboard(base, now);
  test("계정: 익명 제외, 약관 동의한 사람만 쏘웰라 가입자", () => {
    assert.equal(d.accounts.realAccounts, 3);
    assert.equal(d.accounts.sharedAccounts, 4);
    assert.equal(d.accounts.signedUp, 2);
    assert.equal(d.accounts.signupsToday, 1);
    assert.equal(d.accounts.signups7d, 2);
    assert.deepEqual(d.accounts.byProvider, { email: 2, kakao: 1 });
  });
  test("사용자: 채팅한 사람·오늘 활동·세션·메시지(익명 제외)", () => {
    assert.equal(d.usage.chatters, 2);
    assert.equal(d.usage.activeToday, 1);
    assert.equal(d.usage.active7d, 2);
    assert.equal(d.usage.sessions, 3);
    assert.equal(d.usage.userMessages, 3);
    assert.equal(d.usage.totalMessages, 5);
  });
  test("결제: pending은 결제가 아님, 토스/수동 구분, 현재 이용 중, 합계", () => {
    assert.equal(d.payments.payers, 3); // a(토스) b(수동) c(만료된 토스)
    assert.equal(d.payments.tossPayers, 2);
    assert.equal(d.payments.manualPayers, 1);
    assert.equal(d.payments.pending, 1);
    assert.equal(d.payments.activeNow, 2);
    assert.equal(d.payments.revenue, 2900 + 22800 + 2900);
    assert.equal(d.payments.reportBuyers, 1); // user_id 없는 비회원 주문은 사람 수에서 제외
    assert.equal(d.payments.reportOrders, 2);
    assert.equal(d.payments.reportRevenue, 19800);
  });
  test("경고: 세션·계정 단위로 urgent/watch를 세고 익명 계정은 뺀다", () => {
    assert.equal(d.safety.urgentSessions, 1); // s2 (s4는 익명)
    assert.equal(d.safety.watchSessions, 1); // s3
    assert.equal(d.safety.urgentAccounts, 1); // b
    assert.equal(d.safety.watchAccounts, 1); // a: 뿌리 상태 주의 표시
    assert.equal(d.safety.recent[0].email, "b@x.com");
    assert.ok(d.safety.recent.every((r) => r.userId !== "anon"));
  });
  test("최근 14일 추이는 14칸이고 마지막 칸이 오늘", () => {
    assert.equal(d.daily.length, 14);
    assert.equal(d.daily[13].day, "2026-11-17");
    assert.equal(d.daily[13].signups, 1);
    assert.equal(d.daily[13].activeUsers, 1);
  });
  test("자료가 하나도 없어도 0으로 나온다", () => {
    const e = summarizeDashboard({ users: [], profiles: [], sessions: [], messages: [], ents: [], orders: [], roots: [] }, now);
    assert.equal(e.accounts.signedUp, 0);
    assert.equal(e.usage.avgSessionsPerChatter, 0);
    assert.equal(e.payments.payers, 0);
    assert.equal(e.safety.recent.length, 0);
  });
});
