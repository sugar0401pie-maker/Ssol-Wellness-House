// 확률 보정(로드맵 9번) 준비용 읽기 전용 보고: 가설을 말했을 때 사용자가 어떻게 답했는지(sw_hypothesis_log)를 점수 구간·출처별로 집계한다.
//   node --env-file=.env.local scripts/sw_calibration_report.mjs [일수=30]
// 대화 내용은 읽지 않고(라벨·점수만) 쓰지 않는다. 표본이 적은 칸은 "표본 부족"으로 표시해 숫자에 속지 않게 한다.
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const days = Number(process.argv[2] ?? 30), MIN_N = 30;
const since = new Date(Date.now() - days * 86400e3).toISOString();
const { data: log, error } = await admin.from("sw_hypothesis_log").select("user_id,chosen_by,outcome,candidates,chosen_root").gte("at", since).limit(20000);
if (error) { console.error(error.message); process.exit(1); }
const spoke = log.filter((x) => x.chosen_by === "ai" || x.chosen_by === "discriminator");
const answered = spoke.filter((x) => x.outcome && x.outcome !== "no_answer");
console.log(`최근 ${days}일 · 해석 기록 ${log.length}건(분석만 한 것 포함) · 가설을 말한 것 ${spoke.length}건 · 답을 받은 것 ${answered.length}건 · 사용자 ${new Set(spoke.map((x) => x.user_id)).size}명`);
const rate = (rows) => { const n = rows.length, c = rows.filter((x) => x.outcome === "confirmed").length, p = rows.filter((x) => x.outcome === "partial").length; return { n, 맞아요: c, 일부: p, 아니에요: rows.filter((x) => x.outcome === "rejected").length, 맞음비율: n ? `${((100 * (c + 0.5 * p)) / n).toFixed(0)}%` : "-", 표본: n < MIN_N ? "표본 부족(30건 미만) — 숫자를 믿지 마세요" : "충분" }; };
const bucket = (s) => (s == null ? "점수 없음" : s >= 3 ? "3.0 이상" : s >= 2 ? "2.0~3.0" : s >= 1.5 ? "1.5~2.0" : "1.0~1.5");
const groups = {};
for (const x of answered) {
  const score = x.candidates?.find((c) => c.root_id === x.chosen_root)?.score;
  const key = x.chosen_by === "discriminator" ? "가르기 질문" : `가설 · 점수 ${bucket(score)}`;
  (groups[key] ??= []).push(x);
}
console.log("\n구간별 사용자 반응");
if (!answered.length) console.log("  (아직 답을 받은 가설이 없어요 — 실사용이 쌓이면 여기에 구간별 '맞아요' 비율이 나옵니다)");
for (const [k, rows] of Object.entries(groups).sort()) console.log(`  ${k.padEnd(20)}`, rate(rows));
console.log("\n전체", answered.length ? rate(answered) : "-");
console.log(`\n해석: 점수가 높은 구간일수록 '맞아요' 비율이 높아야 점수가 쓸 만한 신호라는 뜻입니다. 30건 이상 쌓이기 전에는 점수 기준(1.0·3.0)을 바꾸지 않습니다.`);
