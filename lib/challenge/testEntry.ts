// 테스트 사이트(쏠 타로 등)에서 쏘웰라로 들어오는 주소 → 쏘웰라 안에서 갈 곳(순수 함수).
// 쏠 타로 2026-11-26 전달: 챌린지 `/challenge?from=tarot&result={결과번호}` · 풍등 `/lantern?from=tarot&result={결과번호}` · 대화 `/chat?from=tarot&result=…`(이건 채팅이 따로 처리).
//  - 챌린지 → `/challenge/start/tarot?result={결과번호}` (그 결과의 report.challenge를 그대로 — 보기 단계 없음, 대표님 2026-11-26)
//  - 예전 주소: `/challenge?theme=<마음>` · `/challenge/start/<마음>?from=test` → `/challenge/start/<마음>?from=test`
//  - 풍등 → `/lantern` (로그인한 뒤 풍등으로 이어지기만 하면 됨)
// 테스트에서 온 주소가 아니면 null. 결과번호는 uuid 모양만 받는다(이상한 값은 버리고 가장 최근 결과로).
import { isThemeKey } from "./themes.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const safeResultId = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);

export function testEntryTarget(pathname: string, search: string): string | null {
  const q = new URLSearchParams(search);
  const from = q.get("from");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/challenge" && from === "tarot") {
    const r = safeResultId(q.get("result"));
    return `/challenge/start/tarot${r ? `?result=${r}` : ""}`;
  }
  if (path === "/challenge" && isThemeKey(q.get("theme"))) return `/challenge/start/${q.get("theme")}?from=test`;
  const m = /^\/challenge\/start\/([^/]+)$/.exec(path);
  if (m && from === "test" && isThemeKey(m[1])) return `/challenge/start/${m[1]}?from=test`;
  if (path === "/lantern" && from) return "/lantern";
  return null;
}

// 맡아 둔 갈 곳이 쏘웰라 안의 이 주소들 중 하나인지(저장소 값을 그대로 믿지 않음)
export const isTestEntryTarget = (v: unknown): v is string =>
  typeof v === "string" && /^\/(challenge\/start\/[a-z]+(\?(from=test|result=[0-9a-f-]{36}))?|lantern)$/.test(v);
