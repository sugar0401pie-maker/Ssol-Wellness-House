"use client";

import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";

// 2026-09-28 owner 요청: 리포트 상세 화면에 형제 사이트(quiz.ssolwellnesshouse.com)의 오각형
// 그래프와 같은 시각화를 추가한다. 외부 차트 라이브러리 없이 순수 SVG로 그린다(이 프로젝트가
// 다른 곳에서도 아이콘 등을 순수 SVG로 직접 그리는 것과 같은 방식).
const AXIS_ORDER = ["CAR", "LOV", "REL", "SLF", "DIR"] as const;
const MAX_SCORE = 5;
const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 82;

function pointFor(index: number, value: number): [number, number] {
  // 12시 방향에서 시계방향으로 5개 축을 배치한다(형제 사이트 그래프와 같은 배치).
  const angle = (Math.PI * 2 * index) / AXIS_ORDER.length - Math.PI / 2;
  const r = (value / MAX_SCORE) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export default function DomainRadarChart({ scores }: { scores: Record<string, number> }) {
  const dataPoints = AXIS_ORDER.map((key, i) => pointFor(i, Math.max(0, Math.min(MAX_SCORE, scores[key] ?? 0))));
  const polygon = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");
  const rings = [1, 2, 3, 4, 5].map((level) => AXIS_ORDER.map((_, i) => pointFor(i, level)).map(([x, y]) => `${x},${y}`).join(" "));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[260px]" role="img" aria-label="영역별 점수 오각형 그래프">
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#DDD6CA" strokeWidth={1} />
      ))}
      {AXIS_ORDER.map((key, i) => {
        const [lx, ly] = pointFor(i, MAX_SCORE);
        const [tx, ty] = pointFor(i, MAX_SCORE * 1.22);
        return (
          <g key={key}>
            <line x1={CENTER} y1={CENTER} x2={lx} y2={ly} stroke="#DDD6CA" strokeWidth={1} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#56616C">
              {DOMAIN_LABELS[key]}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill="#033667" fillOpacity={0.15} stroke="#033667" strokeWidth={2} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#033667" />
      ))}
    </svg>
  );
}
