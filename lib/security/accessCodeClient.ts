// 접속 코드를 브라우저에 저장/조회하는 헬퍼. 이 코드는 화면(UI)만 가리는 게 아니라
// 서버(/api/chat, /api/memory)도 매 요청마다 같은 값을 검사한다 — lib/security/accessCode.ts 참고.
const KEY = "ssol_access_code";

export function getStoredAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessCode(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // 저장 실패해도(프라이빗 모드 등) 이번 세션 안에서는 계속 쓸 수 있으니 무시
  }
}

export function clearStoredAccessCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
