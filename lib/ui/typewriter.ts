// 화면에서만 타이핑되는 것처럼 보이게 하는 연출. 실제 답변은 이미 안전 검사를 통과해 완성된
// 텍스트이고, 이건 그걸 빠르게 한 글자씩 보여주는 것뿐이다 (진짜 스트리밍이 아님 — 안전 검사를
// 통과하기 전 내용을 화면에 미리 보여주지 않기 위한 의도적인 설계).
export function revealText(fullText: string, onUpdate: (partial: string) => void, minMs = 450, maxMs = 1400): () => void {
  const durationMs = Math.min(Math.max(fullText.length * 4, minMs), maxMs);
  const start = performance.now();
  let raf = 0;

  function step(now: number) {
    const ratio = Math.min((now - start) / durationMs, 1);
    onUpdate(fullText.slice(0, Math.max(1, Math.floor(fullText.length * ratio))));
    if (ratio < 1) raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
