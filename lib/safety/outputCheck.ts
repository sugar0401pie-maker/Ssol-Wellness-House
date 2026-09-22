// AI가 만든 답변이 안전 규칙을 지켰는지 사후 검사한다. 정규식 기반의 최선 노력(best-effort) 검사이며
// 완벽하지 않다 — 실제 운영 로그를 보며 패턴을 계속 넓혀가야 한다 (CLAUDE.md: 안전 로직은 테스트 필요).
//
// 검사 항목:
//  1) 진단처럼 들리는 표현 (SAFE-003/007) — "~인 것 같아요" 같은 완곡한 표현도 포함한다.
//     안전 규칙 원문이 완곡한 진단 암시도 금지하기 때문이다.
//  2) 약물 시작/중단/용량 지시 (SAFE-008)
//  3) 검증 안 된 효과·확률 보장 (SAFE-004/016)
//  4) 임상 chunk를 사용한 답변인데 전문가 상담 안내가 빠진 경우 (SAFE-007)
export type OutputCheckResult = { ok: boolean; violations: string[] };

const DISORDER_NOUNS = [
  "우울증", "불안장애", "공황장애", "양극성장애", "조현병", "섭식장애", "PTSD", "ADHD", "경계선 성격장애",
];
// 진단 명사 뒤에 "사용자에게 해당한다"는 뉘앙스의 서술이 붙으면 완곡해도 위반으로 본다.
const CONFIRMING_PREDICATE = /(인\s*것\s*같|일\s*수도\s*있|이신\s*것\s*같|이\s*맞|가\s*맞|확실|입니다|이에요|예요|진단|판정)/;

const MEDICATION_NOUNS = ["항우울제", "수면제", "정신과 약", "ADHD 약", "약물"];
const MEDICATION_VERBS = /(드세요|드시면|복용|끊으세요|중단하세요|줄이세요|늘리세요|시작하세요|바꾸세요|용량을)/;

const OUTCOME_GUARANTEE = /\d+\s*%|보장(합니다|돼요|해요|해드|된다)|무조건|100\s*프로|반드시\s*좋아|효과가\s*확실/;

const REFERRAL_PHRASES = ["정신건강의학과", "정신과 의사", "의사", "전문가", "상담을 받", "상담 받"];

function findSentences(text: string): string[] {
  return text.split(/(?<=[.!?요다])\s+|\n+/).filter(Boolean);
}

export function checkOutput(reply: string, opts: { usedClinicalChunk: boolean }): OutputCheckResult {
  const violations: string[] = [];
  const sentences = findSentences(reply);

  for (const sentence of sentences) {
    for (const noun of DISORDER_NOUNS) {
      if (sentence.includes(noun) && CONFIRMING_PREDICATE.test(sentence)) {
        violations.push(`진단처럼 들리는 표현: "${sentence.trim().slice(0, 60)}"`);
        break;
      }
    }
    const hasMedNoun = MEDICATION_NOUNS.some((n) => sentence.includes(n));
    if (hasMedNoun && MEDICATION_VERBS.test(sentence)) {
      violations.push(`약물 지시로 읽히는 표현: "${sentence.trim().slice(0, 60)}"`);
    }
    if (OUTCOME_GUARANTEE.test(sentence)) {
      violations.push(`검증되지 않은 효과·확률 보장: "${sentence.trim().slice(0, 60)}"`);
    }
  }

  if (opts.usedClinicalChunk && !REFERRAL_PHRASES.some((p) => reply.includes(p))) {
    violations.push("임상 정보를 참고했는데 전문가 상담 안내가 빠졌습니다.");
  }

  return { ok: violations.length === 0, violations };
}
