import { test } from "node:test";
import assert from "node:assert/strict";
import { SEA_FRIENDS } from "./data.ts";
import { pickSeaFriend, seaFriendDeck } from "./pick.ts";

test("문안: 20마리 · 66개 · 동물마다 3~4개 · 그림이 있고 두 문장", () => {
  assert.equal(SEA_FRIENDS.length, 20);
  assert.equal(SEA_FRIENDS.reduce((n, f) => n + f.items.length, 0), 66);
  for (const f of SEA_FRIENDS) {
    assert.ok(f.items.length >= 3 && f.items.length <= 4, f.name);
    assert.ok(f.images.length > 0 && f.images.every((x) => /^[0-9a-f]{12}$/.test(x)), f.name);
    for (const i of f.items) {
      assert.ok(i.id.startsWith(`${f.name}-`));
      assert.ok(i.title && i.body);
      assert.doesNotMatch(i.body, /반드시|분명히/); // 문안 원칙: 단정 말 없음
    }
  }
});

test("동물을 먼저 뽑아 20마리가 고르게 나온다(4,000번에 동물마다 100~300번)", () => {
  let s = 12345;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const cnt: Record<string, number> = {};
  let last: string | null = null;
  for (let k = 0; k < 4000; k++) {
    const p = pickSeaFriend(last, rand);
    assert.notEqual(p.item.id, last); // 바로 전 이야기는 다시 안 나옴
    assert.ok(p.friend.images.some((x) => p.image === `/sea-friends/${x}.webp`)); // 그 동물이 나오는 그림만
    cnt[p.friend.name] = (cnt[p.friend.name] ?? 0) + 1;
    last = p.item.id;
  }
  assert.equal(Object.keys(cnt).length, 20);
  for (const n of Object.values(cnt)) assert.ok(n > 100 && n < 300);
});

test("난수가 늘 같아도 바로 전 이야기는 다시 나오지 않는다", () => {
  const first = pickSeaFriend(null, () => 0);
  const second = pickSeaFriend(first.item.id, () => 0);
  assert.notEqual(second.item.id, first.item.id);
});

test("확인 전 항목 숨기기 스위치: 숨기면 check 항목이 빠지고, 남는 게 없는 동물은 빠진다", () => {
  const d = seaFriendDeck(true);
  assert.ok(d.every((f) => f.items.every((i) => !i.check)));
  assert.ok(!d.some((f) => f.name === "거북" || f.name === "물개")); // 세 이야기 모두 확인 대상
  assert.equal(seaFriendDeck(false).length, 20);
});

test("여러 친구가 함께 나오는 그림은 나오는 동물 모두의 목록에 있다(그림 한 장 · 이야기는 그중 누구든)", () => {
  const owners = new Map<string, string[]>();
  for (const f of SEA_FRIENDS) for (const img of f.images) owners.set(img, [...(owners.get(img) ?? []), f.name]);
  const shared = [...owners.values()].filter((names) => names.length > 1);
  assert.ok(shared.length > 0);
  assert.ok(shared.some((n) => n.includes("수달") && n.includes("해달")));
});

test("다른 친구 보기: 바로 전과 다른 동물이 나온다(요청문 v1.9.3 1단계)", () => {
  let s = 7;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  let prev = pickSeaFriend(null, rand);
  for (let k = 0; k < 500; k++) {
    const next = pickSeaFriend(prev.item.id, rand, undefined, prev.friend.key);
    assert.notEqual(next.friend.key, prev.friend.key);
    prev = next;
  }
});
