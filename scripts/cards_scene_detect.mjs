// 장면 감지율 확인(2026-10-20): 9개 장면의 대표 말투와 장면과 무관한 말을 실제 분류기(임베딩 후보 + 모델)에 넣어 scene_key를 본다. DB 쓰기 없음.
//   node --env-file=.env.local scripts/cards_scene_detect.mjs [반복=2]
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { buildClaims, buildScenes } from "../lib/interp/claims.ts";
import { buildClaimIndex } from "../lib/interp/search.ts";
import { classifyUtterance } from "../lib/interp/classify.ts";
import * as K from "../lib/interp/vendor/claimClassifier.mjs";

const REPEAT = Number(process.argv[2] ?? 2);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ timeout: 40000, maxRetries: 2 });
const all = async (t) => { const o = []; for (let f = 0; ; f += 1000) { const { data } = await admin.from(t).select("*").range(f, f + 999); o.push(...data); if (data.length < 1000) return o; } };
const claims = buildClaims(await all("sw_ob_claims"), await all("sw_ob_claim_roots"), await all("sw_ob_choice_options"), await all("sw_ob_roots"));
K.setData({ claims, scenes: buildScenes(await all("sw_ob_choice_scenes")) });
const embed = async (texts) => { const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts, encoding_format: "float" }); return r.data.sort((a, b) => a.index - b.index).map((d) => d.embedding); };
const callModel = async ({ system, user }) => (await openai.responses.create({ model: process.env.SW_CLASSIFIER_MODEL || "gpt-5.6-luna", input: [{ role: "system", content: system }, { role: "user", content: user }], max_output_tokens: 900, text: { format: { type: "json_object" } }, reasoning: { effort: "low" } })).output_text?.trim() ?? "";
const index = await buildClaimIndex(claims, embed);
const CASES = [
  ["grp", "단체 운동은 좀 싫어요. 자꾸 빠지게 돼요"], ["grp", "같이 하는 운동 모임이 있는데 가기가 내키지 않아요"],
  ["drained", "사람 만나고 오면 기운이 하나도 없어요"], ["drained", "친구들 만나고 오면 진이 빠져요"],
  ["learn_start", "배우고 싶은 게 있는데 계속 시작을 못 해요"], ["learn_start", "수강 등록을 계속 미루고 있어요"],
  ["mistake_self", "작은 실수를 하면 제가 너무 한심하게 느껴져요"], ["mistake_self", "실수하고 나면 저를 계속 탓하게 돼요"],
  ["own_time", "내 시간에 내 방식대로 하고 싶은데 자꾸 방해받아요"], ["own_time", "남한테 맞추는 게 싫어서 혼자 하는 게 편해요"],
  ["refuse", "부탁을 거절을 못 해서 늘 제가 떠안게 돼요"], ["refuse", "싫은데도 그냥 해 주게 돼요"],
  ["reply_late", "친구가 답장이 늦으면 계속 신경이 쓰여요"], ["reply_late", "카톡을 읽고도 답이 없으면 왜 그러나 싶어요"],
  ["work_fit", "이 일을 계속하는 게 맞는지 모르겠어요"], ["work_fit", "지금 회사가 나랑 맞는지 자꾸 의문이 들어요"],
  ["work_hobby", "회사에서는 성취감이 없어서 취미로 채워요"], ["work_hobby", "일할 때는 뿌듯한 게 없고 취미할 때만 살아 있는 것 같아요"],
  [null, "오늘 날씨가 좋아서 산책했어요"], [null, "점심에 비빔밥 먹었어요"], [null, "요즘 잠을 잘 못 자요"], [null, "이번 주말에 영화 볼까 해요"],
];
let hit = 0, wrong = 0, miss = 0, falseOpen = 0; const detail = [];
for (let r = 0; r < REPEAT; r++) for (const [want, text] of CASES) {
  const res = await classifyUtterance(text, { messageId: "m", chatId: "c" }, { embed, index, callModel });
  const got = res.scene_key ?? null;
  if (want === null) { if (got) { falseOpen++; detail.push(`오탐: "${text}" → ${got}`); } }
  else if (got === want) hit++; else if (got) { wrong++; detail.push(`엉뚱: "${text}" 기대 ${want} → ${got}`); } else { miss++; detail.push(`놓침: "${text}" (${want})`); }
}
const n = CASES.filter((c) => c[0]).length * REPEAT;
console.log(`장면 말 ${n}건: 맞게 잡음 ${hit} · 다른 장면으로 잘못 잡음 ${wrong} · 놓침 ${miss} → 감지율 ${(100 * hit / n).toFixed(0)}%`);
console.log(`장면과 무관한 말 ${CASES.filter((c) => !c[0]).length * REPEAT}건 중 장면으로 잘못 연 것: ${falseOpen}`);
[...new Set(detail)].forEach((d) => console.log("  " + d));
