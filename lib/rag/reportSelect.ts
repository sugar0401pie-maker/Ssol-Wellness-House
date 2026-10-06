// 심층 리포트(8개 섹션) 중 "지금 이야기와 관련 있는 것만" 골라 프롬프트에 넣기 위한 순수 함수들.
// 네트워크·DB·AI 호출이 없어서 테스트할 수 있고(reportSelect.test.ts), 추가 비용이 0원이다.
//
// 2026-10-06 owner 결정: 리포트 전체(최대 6,000자 ≈ 3,460토큰)를 매 메시지마다 넣으면 보고서 보유자는
// 메시지당 약 1원이 더 든다. 그래서 섹션 제목 목록은 항상 알려주되, 본문은 지금 이야기와 가장 관련
// 있어 보이는 섹션 몇 개만 넣는다. 관련도는 임베딩이 아니라 글자 겹침으로 잰다 — 섹션 임베딩을 세션마다
// 저장·관리하는 복잡도 없이도 "상위 몇 개는 항상 넣는" 방식이면 충분하다(문턱으로 자르지 않으므로 관련
// 질문인데 보고서가 통째로 빠지는 일이 없다).
//
// 입력은 loadQuizPersona.buildReportInsight()가 만든 문자열이다: 한 섹션이 한 줄이고 줄은
// "[1. 제목] 본문..." 형식이다(섹션 안 문단은 공백으로 이어져 줄바꿈이 없다). 이미 세션에 캐시된
// 예전 스냅샷도 같은 문자열이라 스키마를 바꿀 필요가 없다.

export type ReportSection = { label: string; body: string };

const LINE = /^\[([^\]]+)\]\s*([\s\S]*)$/;

// 형식이 맞지 않으면(빈 문자열, 예전 형식 등) 빈 배열을 돌려준다 — 호출하는 쪽이 "전체를 그대로" 쓰도록 되돌아간다.
export function splitReportInsight(text: string | null | undefined): ReportSection[] {
  if (!text) return [];
  const out: ReportSection[] = [];
  for (const line of text.split("\n")) {
    const m = LINE.exec(line.trim());
    if (m && m[2].trim()) out.push({ label: m[1].trim(), body: m[2].trim() });
  }
  return out;
}

function bigrams(text: string): Set<string> {
  const clean = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

// 관련도 보강 섹션을 더하려면 넘어야 하는 최소 점수. 실제 리포트로 재 보니 점수가 대체로 0~0.35 범위이고
// ("다른 유형과 잘 맞을까요?" → 궁합 섹션 0.22처럼 진짜 관련은 0.2 이상), "힘들어요"처럼 글자쌍 한두 개가
// 우연히 겹친 정도는 0.1 안팎이라 그 아래는 "관련 없음"으로 본다. 틀려도 기본 섹션(2·8)은 항상 들어간다.
const MIN_RELEVANT_SCORE = 0.15;

// 기본으로 항상 넣는 섹션 — 예전부터 채팅에 가장 바로 쓸모 있다고 본 두 개
// (2. 주목할 만한 부분은 / 8. 이번 주 제안). 번호로 찾으므로 제목 문구가 조금 바뀌어도 동작한다.
// 사용자가 자기 유형을 직접 물어본 경우(characterization)에는 유형·대처 방식 섹션(1, 3)도 같이 넣는다.
// 글자 겹침은 한국어 조사·어미 때문에 정확도가 낮은 편이라, 관련도만으로 섹션을 고르지 않고
// "기본 섹션 + 가장 관련 있어 보이는 섹션 1개(또는 2개)"로 안전하게 구성한다.
const DEFAULT_NUMBERS = { subtle: ["2", "8"], characterization: ["1", "2", "3", "8"] } as const;

export type Selection = {
  selected: ReportSection[];
  labels: string[]; // 전체 섹션 제목(항상 알려준다)
  scores: number[]; // 섹션별 관련도(보정·테스트용)
};

export function selectReportSections(
  sections: ReportSection[],
  query: { message: string; recentUserMessages?: string[] },
  mode: "subtle" | "characterization" = "subtle",
): Selection {
  const labels = sections.map((s) => s.label);
  const extraCount = mode === "characterization" ? 2 : 1;
  const secGrams = sections.map((s) => bigrams(`${s.label} ${s.body}`));
  // 여러 섹션에 두루 나오는 글자쌍(흔한 말)은 덜 세고, 한두 섹션에만 나오는 글자쌍(그 섹션의 주제어)은 더 센다.
  const df = new Map<string, number>();
  for (const g of secGrams) for (const b of g) df.set(b, (df.get(b) ?? 0) + 1);

  // 지금 메시지가 가장 중요하고(2배), 직전 사용자 말은 주제가 이어질 때를 위해 약하게 본다.
  const cur = bigrams(query.message);
  const prev = bigrams((query.recentUserMessages ?? []).slice(-2).join(" "));

  const scores = sections.map((_, i) => {
    let score = 0;
    for (const b of secGrams[i]) {
      const w = 1 / (df.get(b) ?? 1);
      if (cur.has(b)) score += 2 * w;
      else if (prev.has(b)) score += w;
    }
    // 긴 섹션이 글자쌍이 많다는 이유만으로 유리하지 않게 길이로 조금 눌러준다.
    return score / Math.sqrt(secGrams[i].size || 1);
  });

  const isDefault = (sec: ReportSection) => DEFAULT_NUMBERS[mode].some((n) => sec.label.startsWith(`${n}.`));
  let chosen = new Set(sections.map((s, i) => (isDefault(s) ? i : -1)).filter((i) => i >= 0));
  // 번호가 하나도 안 맞는 형식이면(예: 섹션 제목 체계가 바뀐 경우) 앞쪽 두 섹션으로 대신한다.
  if (chosen.size === 0) chosen = new Set(sections.slice(0, 2).map((_, i) => i));

  const extras = scores
    .map((sc, i) => ({ sc, i }))
    .filter((o) => !chosen.has(o.i) && o.sc >= MIN_RELEVANT_SCORE)
    .sort((a, b) => b.sc - a.sc || a.i - b.i)
    .slice(0, extraCount);
  for (const o of extras) chosen.add(o.i);

  // 본문은 원래 섹션 순서대로 보여준다.
  return { selected: sections.filter((_, i) => chosen.has(i)), labels, scores };
}
