import { test } from "node:test";
import assert from "node:assert/strict";
import { chatFacts, chatSignature, claimsFromStates } from "./onboardingChat.ts";

test("장부에서 대화 근거(활성 chat 사건)의 claim만 모은다", () => {
  const c = claimsFromStates({
    "ROOT-1": { ledger: [{ source: "chat", validity: "active", claim: "C-A" }, { source: "chat", validity: "superseded", claim: "C-OLD" }, { source: "test", validity: "active", claim: "C-T" }] },
    "ROOT-2": { ledger: [{ source: "chat", validity: "active", claim: null }, { source: "chat", validity: "active", claim: "C-B" }] },
  });
  assert.deepEqual([...c].sort(), ["C-A", "C-B"]);
});
test("사용자가 꺼낸 주제를 모으고, 장면·정보 칸은 비워 둔다", () => {
  const said = (t: string) => (t.includes("돈") ? ["money"] : t.includes("엄마") ? ["family_expect"] : []);
  const f = chatFacts(new Set(["C-A"]), ["요즘 돈이 빠듯해요", "엄마랑 통화했어요", "날씨 좋네요"], said);
  assert.deepEqual([...f.topics].sort(), ["family_expect", "money"]);
  assert.equal(f.scenes.size, 0);
  assert.equal(f.changed.size, 0);
});
test("서명은 같은 사실이면 순서와 상관없이 같고, 사실이 늘면 달라진다", () => {
  const a = chatFacts(new Set(["C-B", "C-A"]), [], () => []);
  const b = chatFacts(new Set(["C-A", "C-B"]), [], () => []);
  assert.equal(chatSignature(a), chatSignature(b));
  assert.notEqual(chatSignature(a), chatSignature(chatFacts(new Set(["C-A", "C-B", "C-C"]), [], () => [])));
  assert.equal(chatSignature(null), "");
});

import * as OB from "./vendor/onboardingScoring.mjs";
test("엔진: 같음 연결이 대화 사실과 맞으면 그 조각이 맞은 것으로 센다(가까움은 기록만)", () => {
  OB.setData({ chatLinks: [
    { hyp_id: "H-1", cue: "형편을 말할 때", link_type: "topic", target: "money", match: "같음" },
    { hyp_id: "H-1", cue: "그 의미를 말함", link_type: "claim", target: "C-A", match: "가까움(검수)" },
    { hyp_id: "H-1", cue: "장면 진입", link_type: "scene", target: "S-1", match: "같음" },
  ] } as never);
  const facts = chatFacts(new Set(["C-A"]), ["월세 때문에 돈이 빠듯해요"], (t: string) => (t.includes("돈") ? ["money"] : []));
  assert.deepEqual(OB.chatCuesMet("H-1", facts), ["형편을 말할 때"]); // 가까움(검수)은 점수에 안 씀 · 장면은 아직 주지 않아 안 맞음
  assert.deepEqual(OB.chatCuesMet("H-1", null), []);
  OB.setData({ chatLinks: [] } as never);
});
