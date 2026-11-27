// 태어난 지역(시·도) → 경도. 엔진이 진태양시를 계산할 때 쓴다(saju_rules.json policy.trueSolarTime).
// 시·도청 소재지 경도(소수 둘째 자리). 지역을 모르면 엔진 기본값(서울 126.98)을 쓴다.
// 설계 패키지에 지역표가 없어 앱에서 정한 값 — CSO 검수 전.

export const REGIONS: { name: string; longitude: number }[] = [
  { name: "서울", longitude: 126.98 },
  { name: "부산", longitude: 129.08 },
  { name: "대구", longitude: 128.6 },
  { name: "인천", longitude: 126.71 },
  { name: "광주", longitude: 126.85 },
  { name: "대전", longitude: 127.38 },
  { name: "울산", longitude: 129.31 },
  { name: "세종", longitude: 127.29 },
  { name: "경기", longitude: 127.01 },
  { name: "강원", longitude: 127.73 },
  { name: "충북", longitude: 127.49 },
  { name: "충남", longitude: 126.67 },
  { name: "전북", longitude: 127.11 },
  { name: "전남", longitude: 126.46 },
  { name: "경북", longitude: 128.51 },
  { name: "경남", longitude: 128.69 },
  { name: "제주", longitude: 126.5 },
  { name: "해외/모름", longitude: 126.98 },
];

export function longitudeOf(region: string | null | undefined): number | null {
  const hit = REGIONS.find((r) => r.name === region);
  return hit && hit.name !== "해외/모름" ? hit.longitude : null;
}
