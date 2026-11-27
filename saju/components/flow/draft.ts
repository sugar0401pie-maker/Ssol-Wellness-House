"use client";
// 입력 화면 사이에서 값을 들고 다니는 임시 저장(브라우저 탭이 닫히면 사라지는 sessionStorage).
// 화면마다 주소가 따로 있어서(/welcome → /birth → /worry …) 값을 서버에 바로 보내지 않고 여기 모았다가
// 계산 화면에서 한 번에 보낸다. 생년월일은 4가지 테스트가 같이 쓴다(ui_copy.intro.other_tests_note).
// 결과 번호 목록(이전 결과 보기)만 localStorage에 남긴다 — 번호만 있고 생년월일·고민은 없다.
import type { BirthInput } from "@/lib/types";
import type { TestSlug } from "@/lib/tests";

export type FollowupView = {
  intro: string | null;
  question: { key: string; ask: string; options: { id: string; label: string }[] };
};

export type Draft = {
  nickname?: string;
  firstTimer?: string | null;
  birth?: BirthInput;
  ageOk?: boolean;
  worry?: string;
  answers?: { q: string; id: string }[];
  followup?: FollowupView | null;
};

const KEY = "saju.draft";
const HISTORY = "saju.results";

export function readDraft(): Draft {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) || "{}") as Draft;
  } catch {
    return {};
  }
}

export function saveDraft(patch: Partial<Draft>): Draft {
  const next = { ...readDraft(), ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장소를 못 쓰는 브라우저 — 화면 안에서만 이어진다 */
  }
  return next;
}

export type HistoryItem = { id: string; slug: TestSlug; at: string };

export function readHistory(): HistoryItem[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(HISTORY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x?.id === "string" && typeof x?.slug === "string") : [];
  } catch {
    return [];
  }
}

export function addHistory(item: HistoryItem) {
  try {
    const list = [item, ...readHistory().filter((x) => x.id !== item.id)].slice(0, 20);
    window.localStorage.setItem(HISTORY, JSON.stringify(list));
  } catch {
    /* 없어도 결과 주소로는 다시 열 수 있다 */
  }
}
