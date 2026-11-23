// CSO 엔진 시험 묶음(ESM v3.31 — 2026-11-23에 v3.23에서 올림)을 저장소의 엔진 보관본(lib/interp/vendor/*.mjs, lib/cards/vendor/choiceCards.mjs)으로 그대로 돌린다(2026-11-18).
// 시험 묶음은 engine_kit/v3.31/ 에 있고, 그 안의 ssol_*.js는 보관본을 다시 내보내는 연결 파일이다 — 보관본이 원본과 똑같이 동작하는지를 CSO 시험 그대로 확인한다.
// 시험 데이터는 해석 DB 원본과 같은 내용이라 git에 올리지 않는다(.gitignore /engine_kit/). 시험 묶음이 없는 컴퓨터에서는 이 시험을 건너뛴다.
// DB를 읽는 시험(onboarding·db_loader)과 DB에 쓰는 시험(pg_roundtrip)은 여기서 돌리지 않는다 — 필요하면 engine_kit/v3.23/bin/psql(읽기 전용)로 따로.
// 이 파일은 예전 lib/cards/engine.test.mjs(ESM v2.7 카드 회귀 v0.8 + 경로 시험)를 대신한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const KIT = path.resolve(new URL("../../engine_kit/v3.31/", import.meta.url).pathname);
const TESTS = [
  "choice_regression_v0.15.js", "choice_paths_test_v0.8.js", "case_test_v0.11.js", "personal_test_v0.13.js", "worry_match_test_v0.11.js", "report_reply_test_v0.1.js",
  "safety_reply_test_v0.3.js", "ledger_test_v0.3.js", "direction_test_v0.3.js", "motive_test_v0.5.js", "astro_terms_test_v0.1.js", "classifier/classifier_unit_test_v0.8.js",
];
const hasKit = fs.existsSync(path.join(KIT, "data"));

for (const t of TESTS) {
  test(`CSO 엔진 시험 ${t}`, { skip: hasKit ? false : "engine_kit/v3.31 없음(git 제외) — 시험 묶음을 넣으면 돈다" }, () => {
    const file = path.join(KIT, t);
    const r = spawnSync(process.execPath, [path.basename(file)], { cwd: path.dirname(file), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const fails = (r.stdout + r.stderr).split("\n").filter((l) => /^FAIL\b|문제 [1-9]/.test(l));
    assert.equal(r.status, 0, `${t} 종료 코드 ${r.status}\n${fails.slice(0, 5).join("\n")}\n${r.stderr.slice(0, 400)}`);
    assert.deepEqual(fails, []);
  });
}
