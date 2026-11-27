import "server-only";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StoredResult } from "./types";

// 결과 저장소.
// 지금은 개발용 로컬 파일(.data/results, git 제외)만 있다. Vercel 서버는 파일이 남지 않으므로
// 배포 전에 Supabase 테이블(supabase/saju_results.sql)로 바꿔야 한다 — 이 파일의 세 함수만 바꾸면 된다.
// 결과 번호는 추측하기 어려운 UUID(주소만 알면 열리므로 짧은 일련번호를 쓰지 않는다).
// 쏘웰라가 테스트 결과 번호를 UUID 모양만 받으므로(메인 저장소 lib/challenge/testEntry.ts) UUID로 맞춘다.

const DIR = path.join(process.cwd(), ".data", "results");

function assertDevStore() {
  if (process.env.VERCEL) {
    throw new Error("saju 결과 저장소가 아직 로컬 파일이에요. 배포 전에 Supabase 저장소로 바꿔야 해요(lib/store.ts).");
  }
}

export function newResultId(): string {
  return randomUUID();
}

export const isResultId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

const fileOf = (id: string) => {
  if (!isResultId(id)) return null; // 경로 조작 방지
  return path.join(DIR, `${id}.json`);
};

export async function saveResult(r: StoredResult): Promise<void> {
  assertDevStore();
  mkdirSync(DIR, { recursive: true });
  const f = fileOf(r.id);
  if (!f) throw new Error("bad id");
  writeFileSync(f, JSON.stringify(r));
}

export async function getResult(id: string): Promise<StoredResult | null> {
  assertDevStore();
  const f = fileOf(id);
  if (!f || !existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8")) as StoredResult;
}

export async function markPaid(id: string): Promise<StoredResult | null> {
  const r = await getResult(id);
  if (!r) return null;
  if (!r.paid) {
    r.paid = true;
    r.paidAt = new Date().toISOString();
    await saveResult(r);
  }
  return r;
}

/** 첫 화면 참여자 수(4종 합산). 300명 미만이면 화면에서 숨긴다(ui_copy.intro.participants_rule). */
export async function countResults(): Promise<number> {
  if (process.env.VERCEL || !existsSync(DIR)) return 0;
  return readdirSync(DIR).filter((f) => f.endsWith(".json")).length;
}
