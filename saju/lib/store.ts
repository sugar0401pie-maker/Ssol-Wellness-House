import "server-only";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StoredResult } from "./types";
import { slugOf, testName } from "./tests";

// 결과 저장소.
// - 운영: Supabase saju_results 테이블(supabase/saju_results.sql). 쏘웰라와 같은 프로젝트라 쏘웰라가
//   report->'challenge'(작심삼일 다섯 칸)를 읽어 갈 수 있다. 서버 키(service role)로만 읽고 쓴다.
// - 개발: Supabase 키가 없으면 로컬 파일(.data/results, git 제외). Vercel에서는 파일이 남지 않으므로 막는다.
// 결과 번호는 추측하기 어려운 UUID(주소만 알면 열리므로 짧은 일련번호를 쓰지 않는다).
// 쏘웰라가 테스트 결과 번호를 UUID 모양만 받으므로(메인 저장소 lib/challenge/testEntry.ts) UUID로 맞춘다.
// Supabase 호출은 data와 error를 함께 확인한다(error를 버리면 '결과 없음'처럼 보이는 사고가 메인 앱에서 두 번 있었음).

export type PaymentInfo = { orderId: string; paymentKey: string; amount: number };

export function newResultId(): string {
  return randomUUID();
}

export const isResultId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

// ── Supabase ─────────────────────────────────────────────────────────
let sb: SupabaseClient | null | undefined;
function supabase(): SupabaseClient | null {
  if (sb !== undefined) return sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  sb = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return sb;
}

type Row = {
  id: string;
  test_type: string;
  nickname: string;
  worry_text: string;
  report: { page: StoredResult["page"]; challenge: StoredResult["challenge"]; timeNote: string };
  safety_level: StoredResult["safetyLevel"];
  paid_at: string | null;
  created_at: string;
};

const COLS = "id,test_type,nickname,worry_text,report,safety_level,paid_at,created_at";

function fromRow(r: Row): StoredResult | null {
  const slug = slugOf(r.test_type);
  if (!slug) return null;
  return {
    id: r.id,
    slug,
    createdAt: r.created_at,
    nickname: r.nickname,
    worry: r.worry_text,
    page: r.report.page,
    paid: r.paid_at !== null,
    paidAt: r.paid_at,
    safetyLevel: r.safety_level,
    timeNote: r.report.timeNote ?? "",
    challenge: r.report.challenge ?? null,
  };
}

// ── 로컬 파일(개발용) ─────────────────────────────────────────────────
const DIR = path.join(process.cwd(), ".data", "results");
function fileOf(id: string) {
  if (!isResultId(id)) return null; // 경로 조작 방지
  if (process.env.VERCEL) {
    throw new Error("Supabase 키(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 없어 결과를 저장할 수 없어요.");
  }
  return path.join(DIR, `${id}.json`);
}

// ── 공개 함수 ─────────────────────────────────────────────────────────
export async function saveResult(r: StoredResult): Promise<void> {
  const db = supabase();
  if (db) {
    const { error } = await db.from("saju_results").insert({
      id: r.id,
      test_type: testName(r.slug),
      nickname: r.nickname,
      worry_text: r.worry,
      // report.challenge = 쏘웰라가 읽는 작심삼일 다섯 칸(쏠 타로의 tarot_sessions.report.challenge와 같은 자리)
      report: { page: r.page, challenge: r.challenge, timeNote: r.timeNote },
      safety_level: r.safetyLevel,
      paid_at: r.paidAt,
    });
    if (error) throw new Error(`saju_results 저장 실패: ${error.message}`);
    return;
  }
  const f = fileOf(r.id);
  if (!f) throw new Error("bad id");
  mkdirSync(DIR, { recursive: true });
  writeFileSync(f, JSON.stringify(r));
}

export async function getResult(id: string): Promise<StoredResult | null> {
  if (!isResultId(id)) return null;
  const db = supabase();
  if (db) {
    const { data, error } = await db.from("saju_results").select(COLS).eq("id", id).maybeSingle();
    if (error) throw new Error(`saju_results 읽기 실패: ${error.message}`);
    return data ? fromRow(data as Row) : null;
  }
  const f = fileOf(id);
  if (!f || !existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8")) as StoredResult;
}

/** 결제 완료 기록. 토스 승인 확인이 끝난 뒤에만 부른다(이미 결제된 결과는 그대로 둠). */
export async function markPaid(id: string, pay: PaymentInfo | null = null): Promise<StoredResult | null> {
  const db = supabase();
  if (db) {
    const { error } = await db
      .from("saju_results")
      .update({
        paid_at: new Date().toISOString(),
        order_id: pay?.orderId ?? null,
        payment_key: pay?.paymentKey ?? null,
        paid_amount: pay?.amount ?? null,
      })
      .eq("id", id)
      .is("paid_at", null);
    if (error) throw new Error(`saju_results 결제 기록 실패: ${error.message}`);
    return getResult(id);
  }
  const r = await getResult(id);
  if (!r) return null;
  if (!r.paid) {
    r.paid = true;
    r.paidAt = new Date().toISOString();
    const f = fileOf(id);
    if (f) writeFileSync(f, JSON.stringify(r));
  }
  return r;
}

/** 첫 화면 참여자 수(4종 합산). 300명 미만이면 화면에서 숨긴다(ui_copy.intro.participants_rule). 실패하면 0(숨김). */
export async function countResults(): Promise<number> {
  const db = supabase();
  if (db) {
    const { count, error } = await db.from("saju_results").select("id", { count: "exact", head: true });
    return error ? 0 : (count ?? 0);
  }
  if (process.env.VERCEL || !existsSync(DIR)) return 0;
  return readdirSync(DIR).filter((f) => f.endsWith(".json")).length;
}
