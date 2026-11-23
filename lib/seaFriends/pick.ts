// 홈 첫 화면 "오늘의 바다 친구" 고르기 — 순수 함수(2026-11-23 문안 문서 0장 "보여 주는 방식").
// 20마리가 같은 확률로 나오도록 동물을 먼저 뽑고, 그 동물의 이야기(3~4개) 중 하나를 뽑는다. 바로 전에 본 이야기는 다시 나오지 않는다.
// 그림은 그 동물이 나오는 정사각 그림(혼자·함께) 중에서 무작위. 클라이언트에서 쓰므로 "server-only"를 넣지 않는다.
import { SEA_FRIENDS, type SeaFriend, type SeaFriendItem } from "./data.ts";

// 문안 문서 3장 "게시 전 확인할 것" 항목을 숨기려면 true(그 동물에 남는 이야기가 없으면 동물째 빠진다).
export const HIDE_UNCHECKED = false;

export type SeaFriendPick = { friend: SeaFriend; item: SeaFriendItem; image: string };

export function seaFriendDeck(hideUnchecked = HIDE_UNCHECKED, deck: SeaFriend[] = SEA_FRIENDS): SeaFriend[] {
  if (!hideUnchecked) return deck;
  return deck.map((f) => ({ ...f, items: f.items.filter((i) => !i.check) })).filter((f) => f.items.length > 0);
}

export function pickSeaFriend(lastItemId: string | null, rand: () => number = Math.random, deck: SeaFriend[] = seaFriendDeck()): SeaFriendPick {
  const at = <T,>(xs: T[]) => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];
  let friend = at(deck), item = at(friend.items);
  for (let guard = 0; item.id === lastItemId && guard < 20; guard++) { friend = at(deck); item = at(friend.items); }
  if (item.id === lastItemId) { // 운이 나빠도(난수가 고정된 시험 등) 같은 이야기를 두 번 보이지 않는다
    const rest = deck.flatMap((f) => f.items.filter((i) => i.id !== lastItemId).map((i) => ({ f, i })));
    if (rest.length) ({ f: friend, i: item } = rest[0]);
  }
  return { friend, item, image: `/sea-friends/${friend.key}/${at(friend.images)}` };
}
