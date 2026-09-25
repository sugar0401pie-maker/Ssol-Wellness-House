// 순위형(ranked) 질문의 선택 로직 — 배열의 순서 자체가 순위다(0번째=1순위).
// 원형 버튼에 표시하는 숫자는 이 배열에서의 index+1일 뿐이라, 하나를 해제하면 뒤 순위가
// 자동으로 당겨진다(배열에서 그냥 빠지므로). 순수 함수라 네트워크 없이 테스트할 수 있다.

export function toggleRank(
  current: readonly string[],
  code: string,
  options: { maxRank: number; exclusiveCodes?: readonly string[] },
): string[] {
  const exclusiveCodes = options.exclusiveCodes ?? [];
  const isExclusive = exclusiveCodes.includes(code);

  if (current.includes(code)) {
    // 이미 선택된 걸 다시 누르면 해제 — 뒤 순위는 배열에서 자동으로 당겨진다.
    return current.filter((c) => c !== code);
  }

  if (isExclusive) {
    // "아직 못 찾았어요"류 배타 옵션 — 선택하면 기존 선택을 모두 비우고 이것만 남긴다.
    return [code];
  }

  // 지금 배타 옵션이 선택돼 있었다면, 일반 옵션을 고르는 순간 배타 선택을 지운다.
  const withoutExclusive = current.filter((c) => !exclusiveCodes.includes(c));

  if (withoutExclusive.length >= options.maxRank) {
    return withoutExclusive; // 이미 꽉 찼으면 더 추가하지 않는다("최대 N개" 안내는 UI에서 별도 처리)
  }
  return [...withoutExclusive, code];
}

export function rankOf(current: readonly string[], code: string): number | null {
  const idx = current.indexOf(code);
  return idx === -1 ? null : idx + 1;
}

export type RankedAnswer = { key: string; rank: number; other_text?: string };

// 저장 형식으로 변환: [{"key":"career_success","rank":1}, ...] (스펙 4.1 최종 저장 형식과 동일)
export function toRankedAnswers(current: readonly string[], otherText?: string): RankedAnswer[] {
  return current.map((key, i) => {
    const rank = i + 1;
    return key === "other" && otherText ? { key, rank, other_text: otherText } : { key, rank };
  });
}
