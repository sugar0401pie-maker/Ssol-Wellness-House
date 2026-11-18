// 종합(전체) 내보내기에서 쓰는 개인 식별 줄이기. 계정 → 되돌릴 수 없는 짧은 코드, 글 속 연락처 가리기.
// 완벽하지 않다 — 대화 글에 이름·장소 등이 풀어서 쓰여 있으면 남는다. 그래서 종합 내보내기는 내부 검토용으로만 쓰도록 안내한다.
import { createHmac } from "node:crypto";

export function pseudonymCode(userId: string, secret: string): string {
  return `U-${createHmac("sha256", secret).update(userId).digest("hex").slice(0, 8).toUpperCase()}`;
}

// 검색창에 넣은 이용자 코드 정리: 대소문자·앞뒤 공백·"U-" 빠뜨림을 허용한다("u-1a2b3c4d", "1A2B3C4D" → "U-1A2B3C4D"). 코드 모양이 아니면 null.
export function normalizeUserCode(q: string): string | null {
  const m = q.trim().toUpperCase().match(/^(?:U-?)?([0-9A-F]{8})$/);
  return m ? `U-${m[1]}` : null;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<!\d)(?:\+?82[-\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const RRN = /(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)/g;

export function maskContacts(text: string): string {
  return text.replace(RRN, "[주민번호]").replace(EMAIL, "[이메일]").replace(PHONE, "[전화번호]");
}
