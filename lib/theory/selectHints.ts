// 이론 고르기에서 자주 헷갈리는 쌍의 구분 단서(2026-10-07). 이론 설명(plain_focus)은 owner가 검수한 사용자 노출 가능 문구라 고치지 않고,
// 선택 프롬프트에만 덧붙인다. 단서의 출처는 판별 예시 문장 추가본(SSOL_Signals_Add_v0_1.xlsx)의 "경계" 문장 메모(owner 작성) — 새로 지어내지 않았다.
// 두 이론이 모두 후보 목록에 있을 때만 프롬프트에 들어간다. 평가에서 가장 많이 틀린 쌍(EFT↔IPT, ACT↔LOGO)부터 시작했고, 로그를 보며 쌍을 늘린다.
export type SelectHint = { pair: [string, string]; lines: Record<string, string> };

export const SELECT_HINTS: SelectHint[] = [
  {
    pair: ["EFT", "IPT"],
    lines: {
      EFT: "연인·가까운 사람과 서로 정서적으로 닿지 않는 이야기 — \"내가 이 사람한테 중요한가\", 위로받고 싶은데 해결책만 돌아옴, 싸운 뒤 사이가 멀어질까 무서움, 한쪽이 다가가면 다른 쪽이 물러나는 되풀이, 화 아래 서운함·바람",
      IPT: "연애·부부·직장·가족 어디든 기대 차이·분담·역할 변화·새로 바뀐 상황 이야기 — 비용·집안일 기준, 누가 뭘 맡을지, 복직·출산 후 역할 재정립, 새 팀·이번 사건에서 부딪힘. 정서적 연결이나 애착 단서가 없으면 연애여도 IPT",
    },
  },
  {
    pair: ["ACT", "LOGO"],
    lines: {
      ACT: "무엇이 중요한지·가려는 방향은 이미 아는데, 생각이나 불안·긴장이 올라올 때 멈추거나 피하거나 끌려감. 감정을 없애려 애쓰는 게 더 힘듦 — 감정을 그대로 두고 움직이는 쪽",
      LOGO: "무엇이 나에게 의미 있는지 모르겠다·열심히 사는데 속이 빈 느낌(움직임은 잘함), 나 말고 누군가에게 쓰이고 싶음(나 밖을 향한 의미), 증상과 싸우지 말고 일부러 과장해 웃어넘겨보기(역설 의도)",
    },
  },
];

// 후보 목록에 쌍이 모두 있을 때만 해당 구분 단서를 문장으로 만든다.
export function buildHintLines(candidateIds: string[], hints: SelectHint[] = SELECT_HINTS): string[] {
  return hints
    .filter((h) => h.pair.every((id) => candidateIds.includes(id)))
    .map((h) => `- ${h.pair.join("와 ")} 구분: ${h.pair.map((id) => `${id}는 ${h.lines[id]}`).join(" / ")}`);
}
