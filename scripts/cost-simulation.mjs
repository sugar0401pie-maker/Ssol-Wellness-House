// AI 비용 시뮬레이션 — 실제 파이프라인(안전 라우팅 + 검색 + 답변 생성)을 진짜로 돌려서
// 토큰 사용량을 재고, 하루 5/10/20/30회 사용 시 월 비용을 계산한다.
//
// 준비: 다른 터미널에서 `npm run dev` (포트 3100)가 떠 있어야 한다.
// 실행: npm run cost:sim
// 비용: 실제로 20여 회 대화를 생성하므로 몇십 원 수준의 실제 요금이 발생한다.
// 테스트로 만든 임시 계정과 대화는 끝나면 자동 삭제한다.
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";

// 2026-09-22 기준 공식 가격 (달러/100만 토큰). 모델이나 요금이 바뀌면 이 값을 갱신해야 한다.
const PRICING_USD_PER_MTOK = {
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2.0, output: 12.0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};
const USD_TO_KRW = Number(process.env.USD_TO_KRW || 1400); // 환율 가정치 — 실제 결제 시점 환율로 다시 계산 필요
const KRW_MONTHLY_CAP = 3000; // 승인된 1인당 월 상한

// 대표 대화 시나리오. 짧은 단발 질문(A)과, 맥락이 쌓이는 4턴 대화(B) 두 종류를 함께 재본다.
// crisis/violence는 고정 응답이라 비용이 사실상 0이므로 시뮬레이션 대상에서 뺐다.
const SINGLE_TURN = [
  "요즘 별문제 없는데 공허해요",
  "완벽하게 못 할 것 같아서 시작을 못 하겠어요",
  "퇴사할지 계속 다닐지 모르겠어요",
  "제가 ADHD인지 궁금해요",
  "우울감이 몇 주째 계속돼요",
  "SSOL 웰니스 세션 가격이 얼마예요?",
  "남자친구랑 자주 다퉈요",
  "오늘 하루가 그냥 무기력했어요",
];
const CONVERSATION = [
  "요즘 되는 일이 하나도 없는 것 같아요",
  "일도 관계도 다 애매하게 흘러가는 느낌이에요",
  "예전에는 안 그랬는데 요즘따라 유독 그래요",
  "그래도 뭔가 하나는 바꿔보고 싶긴 해요",
];

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data: signIn, error: signInErr } = await anon.auth.signInAnonymously();
if (signInErr || !signIn.session) {
  console.error("시뮬레이션용 임시 계정 로그인 실패:", signInErr?.message);
  process.exit(1);
}
const token = signIn.session.access_token;
const testUserId = signIn.user.id;

async function send(message, sessionId) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, sessionId }),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error(`요청 실패 (${res?.status ?? "연결 안 됨"})`);
  return res.json();
}

const records = []; // { classifierIn, classifierOut, genIn, genOut }
try {
  console.log("단발 질문 8건 측정 중...");
  for (const msg of SINGLE_TURN) {
    const data = await send(msg, null);
    records.push(data.usage);
    console.log(`  [${data.route}] 분류 ${data.usage.classifierInputTokens}/${data.usage.classifierOutputTokens} · 생성 ${data.usage.generationInputTokens}/${data.usage.generationOutputTokens} 토큰${data.usage.regenerated ? " (재생성 1회)" : ""}`);
  }

  console.log("\n4턴 대화 1건 측정 중 (맥락이 쌓일 때 비용 변화 확인)...");
  let sessionId = null;
  for (const msg of CONVERSATION) {
    const data = await send(msg, sessionId);
    sessionId = data.sessionId;
    records.push(data.usage);
    console.log(`  [${data.route}] 분류 ${data.usage.classifierInputTokens}/${data.usage.classifierOutputTokens} · 생성 ${data.usage.generationInputTokens}/${data.usage.generationOutputTokens} 토큰`);
  }
} finally {
  const { error: delErr } = await admin.auth.admin.deleteUser(testUserId);
  if (delErr) console.warn("임시 계정 정리 실패(수동 확인 필요):", delErr.message);
}

// 평균 계산 (실제 생성이 일어난 메시지만 — classifierUnavailable 등으로 0인 경우는 없다고 가정)
const avg = (key) => records.reduce((s, r) => s + r[key], 0) / records.length;
const avgUsage = {
  classifierIn: avg("classifierInputTokens"),
  classifierOut: avg("classifierOutputTokens"),
  genIn: avg("generationInputTokens"),
  genOut: avg("generationOutputTokens"),
};
// 검색용 임베딩(사용자 질문 1회, 짧은 텍스트)은 이 측정에 안 잡히므로 넉넉히 30토큰으로 추정해 더한다.
const EMBED_TOKENS_ESTIMATE = 30;

function costPerMessageUSD(model) {
  const p = PRICING_USD_PER_MTOK[model];
  const classifierCost = (avgUsage.classifierIn * p.input + avgUsage.classifierOut * p.output) / 1_000_000;
  const genCost = (avgUsage.genIn * p.input + avgUsage.genOut * p.output) / 1_000_000;
  const embedCost = (EMBED_TOKENS_ESTIMATE * PRICING_USD_PER_MTOK["text-embedding-3-small"].input) / 1_000_000;
  return classifierCost + genCost + embedCost;
}

console.log("\n=== 측정된 평균 토큰 사용량 (메시지 1건당, 실제 응답 12건 평균) ===");
console.log(
  `  분류기: 입력 ${avgUsage.classifierIn.toFixed(0)} / 출력 ${avgUsage.classifierOut.toFixed(0)} 토큰`,
);
console.log(`  생성:   입력 ${avgUsage.genIn.toFixed(0)} / 출력 ${avgUsage.genOut.toFixed(0)} 토큰`);
console.log(`  검색 임베딩: 약 ${EMBED_TOKENS_ESTIMATE} 토큰 (추정)`);

console.log(`\n=== 예상 월 비용 (환율 1달러=${USD_TO_KRW}원 가정, 1인당 월 상한 ${KRW_MONTHLY_CAP}원) ===`);
console.log(`${"모델".padEnd(16)}${"1건당(원)".padStart(10)}${"하루5회×30일".padStart(16)}${"하루10회×30일".padStart(16)}${"하루20회×30일".padStart(16)}${"하루30회×30일".padStart(16)}`);
for (const model of ["gpt-5.6-luna", "gpt-5.6-terra"]) {
  const perMsgKRW = costPerMessageUSD(model) * USD_TO_KRW;
  const row = [5, 10, 20, 30].map((n) => `${Math.round(perMsgKRW * n * 30).toLocaleString("ko-KR")}원`.padStart(16));
  console.log(`${model.padEnd(16)}${(perMsgKRW.toFixed(1) + "원").padStart(10)}${row.join("")}`);
}

console.log(`\n(gpt-5.6-terra 열은 luna와 같은 토큰 수를 가정한 참고값입니다 — terra는 실제로는 더 길거나 다르게 답할 수 있어 정확한 비교는 아닙니다.)`);
console.log(`(하루 1회당 채팅권 유효기간을 1주일로 계산하면: 하루5회×7일 = 35건, 하루10회×7일 = 70건 — 아래에서 직접 곱해 확인하세요.)`);
