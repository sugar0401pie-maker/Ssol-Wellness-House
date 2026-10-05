import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_RANK_SCORES, domainRankScore, pickDailyPool } from "./domainRank.ts";

type P = { id: string; domain: string; category: string; secondaryDomains?: string[] };
const mk = (id: string, domain: string, category: string, secondaryDomains: string[] = []): P => ({
  id, domain, category, secondaryDomains,
});

describe("domainRankScore — 1순위/2순위/3순위 가산점", () => {
  test("1순위 일치 5 / 2순위 일치 3 / 3순위 일치 2 / 불일치·대상 없음 0", () => {
    assert.deepEqual([...DOMAIN_RANK_SCORES], [5, 3, 2]);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["삶의 방향"]), "커리어"), 5);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["삶의 방향"]), "삶의 방향"), 3);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["나 자신", "삶의 방향"]), "삶의 방향"), 2);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["나 자신", "관계", "삶의 방향"]), "삶의 방향"), 2); // 4순위 이하도 마지막 점수
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["삶의 방향"]), "연애"), 0);
    assert.equal(domainRankScore(mk("a", "커리어", "x"), "삶의 방향"), 0);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["삶의 방향"]), null), 0);
    assert.equal(domainRankScore(mk("a", "커리어", "x", ["삶의 방향"]), undefined), 0);
  });

  test("secondaryDomains가 아예 없는 행(마이그레이션 전)도 1순위 점수는 그대로", () => {
    assert.equal(domainRankScore({ domain: "관계" }, "관계"), 5);
    assert.equal(domainRankScore({ domain: "관계" }, "삶의 방향"), 0);
  });
});

describe("pickDailyPool — 1순위 → 2순위 → 전체", () => {
  const pool = [
    mk("c1", "커리어", "생각 전환하기"),
    mk("c2", "커리어", "나를 돌보기", ["삶의 방향"]),
    mk("s1", "나 자신", "나를 돌보기", ["삶의 방향"]),
    mk("s2", "나 자신", "몸으로 움직이기"),
    mk("r1", "관계", "나를 돌보기"),
  ];

  test("1순위 후보가 있는 영역은 2순위 항목이 섞이지 않는다(기존 동작 유지)", () => {
    assert.deepEqual(pickDailyPool(pool, { domain: "나 자신" }).map((p) => p.id), ["s1", "s2"]);
    assert.deepEqual(pickDailyPool(pool, { domain: "커리어" }).map((p) => p.id), ["c1", "c2"]);
  });

  test("영역+세부유형이 둘 다 맞는 후보가 있으면 그것부터", () => {
    assert.deepEqual(pickDailyPool(pool, { domain: "나 자신", category: "몸으로 움직이기" }).map((p) => p.id), ["s2"]);
  });

  test("1순위 후보가 0개인 영역(삶의 방향)은 2순위 항목으로 내려간다", () => {
    assert.deepEqual(pickDailyPool(pool, { domain: "삶의 방향" }).map((p) => p.id), ["c2", "s1"]);
  });

  test("2순위에서도 세부유형이 맞는 것이 있으면 그것부터, 없으면 2순위 전체", () => {
    assert.deepEqual(pickDailyPool(pool, { domain: "삶의 방향", category: "나를 돌보기" }).map((p) => p.id), ["c2", "s1"]);
    assert.deepEqual(pickDailyPool(pool, { domain: "삶의 방향", category: "몸으로 움직이기" }).map((p) => p.id), ["c2", "s1"]);
  });

  test("영역이 없거나, 1·2순위 모두 없는 영역이면 전체 풀(예전 fallback과 동일)", () => {
    assert.equal(pickDailyPool(pool, {}).length, 5);
    assert.equal(pickDailyPool(pool, { category: "나를 돌보기" }).length, 5); // 세부유형만으로는 좁히지 않는다
    assert.equal(pickDailyPool(pool, { domain: "없는 영역" }).length, 5);
  });
});
