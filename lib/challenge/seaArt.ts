// 사진 없이 저장한 날, 카드 가운데에 들어가는 바다 친구 그림(대표님 2026-11-25 — 해양생물 캐릭터를 무작위로).
// "무작위"지만 같은 챌린지·같은 일차는 늘 같은 그림(다시 볼 때 카드가 바뀌지 않게) — 챌린지 id와 일차로 고른다.
import { SEA_FRIENDS } from "../seaFriends/data.ts";

const ALL = [...new Set(SEA_FRIENDS.flatMap((f) => f.images))];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const seaArtFor = (seed: string): string => `/sea-friends/${ALL[hash(seed) % ALL.length]}.webp`;
export const seaArtCount = ALL.length;
