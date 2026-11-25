// 그림 있는 화면(홈·갓생러모임)의 달과 별(요청문 v1.9.4 12-2·12-5장) — 그림 파일 없이 코드로 그린다. 글이 많은 화면에는 넣지 않는다.
// 달: 오른쪽 위, 지름은 화면 폭의 약 12%. 별: 위쪽 하늘에 두 묶음(8개씩), 두 번째 묶음은 천천히 깜빡인다(움직임 줄이기에서는 멈춤 — globals.css).
// 홈 위에 배너가 보이면 달을 숨긴다(.ssol-home:has(.ssol-banner) — globals.css).
const A = [
  [6, 8],
  [18, 3],
  [31, 11],
  [44, 5],
  [57, 14],
  [70, 4],
  [9, 21],
  [38, 24],
];
const B = [
  [13, 14],
  [25, 7],
  [50, 19],
  [63, 9],
  [76, 22],
  [90, 27],
  [3, 30],
  [29, 32],
];

// moon=false: 그림 안에 이미 달이 있는 화면(갓생러모임 — 대표님 2026-11-25 "그림에도 달이 있어서 겹쳐, 겹치는 달은 숨겨줘")
export default function SkyDecor({ moon = true }: { moon?: boolean } = {}) {
  return (
    <>
      {/* 달은 따로 그린다(별 층은 화면 비율에 맞춰 늘어나서, 그 안에 그리면 타원이 됨) */}
      {moon && (
        <span
          className="ssol-moon pointer-events-none absolute right-[7%] top-[18px] aspect-square w-[12%] rounded-full"
          style={{
            background: "var(--moon)",
            boxShadow: "0 0 24px rgba(246,239,213,.35)",
          }}
          aria-hidden="true"
        />
      )}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[34%] w-full"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="var(--star)">
          {A.map(([x, y]) => (
            <circle key={`a${x}`} cx={x} cy={y} r="0.35" />
          ))}
        </g>
        <g className="ssol-star-b" fill="#eef4ff">
          {B.map(([x, y]) => (
            <circle key={`b${x}`} cx={x} cy={y} r="0.3" />
          ))}
        </g>
      </svg>
    </>
  );
}
