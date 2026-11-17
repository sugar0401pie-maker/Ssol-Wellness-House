// 기간 입력(YYYY-MM-DD, 한국 시간 기준) → 조회 범위. 비워 두면 그쪽 끝은 제한 없음(가입부터 ~ 오늘까지 전체).
// 끝 날짜는 "그날 하루 전체를 포함"하므로 다음 날 0시(한국 시간) 미만으로 자른다.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type Range = { fromIso: string | null; toIso: string | null; label: string };

function validDay(s: string): boolean {
  if (!DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00+09:00`);
  return !Number.isNaN(d.getTime()) && new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d) === s;
}

export function parseRange(from?: string | null, to?: string | null): { ok: true; range: Range } | { ok: false; error: string } {
  const f = from?.trim() || "";
  const t = to?.trim() || "";
  if (f && !validDay(f)) return { ok: false, error: "시작 날짜 형식이 올바르지 않아요(예: 2026-11-01)." };
  if (t && !validDay(t)) return { ok: false, error: "끝 날짜 형식이 올바르지 않아요(예: 2026-11-17)." };
  if (f && t && f > t) return { ok: false, error: "시작 날짜가 끝 날짜보다 늦어요." };
  const fromIso = f ? new Date(`${f}T00:00:00+09:00`).toISOString() : null;
  const toIso = t ? new Date(new Date(`${t}T00:00:00+09:00`).getTime() + 86_400_000).toISOString() : null;
  const label = f || t ? `${f || "가입 시점"} ~ ${t || "오늘"}` : "전체(가입부터 오늘까지)";
  return { ok: true, range: { fromIso, toIso, label } };
}

export function kstDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return p; // "YYYY-MM-DD HH:mm"
}

export const kstDay = (iso: string | number | Date): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));
