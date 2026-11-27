// 문구 안의 {nickname}·{short}·{price} 같은 자리를 채운다(서버·브라우저 둘 다 쓰는 순수 함수).
// 엔진의 조사 자리({일:을} 등)는 엔진이 이미 채워서 주므로 여기서는 이름 자리만 다룬다.
export function fill(text: string, vars: Record<string, string | number>): string {
  return String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
