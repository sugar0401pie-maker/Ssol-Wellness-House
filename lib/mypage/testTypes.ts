// 마이페이지 "테스트 결과 열람하기"의 공통 모양(서버·브라우저 모두에서 쓰는 타입만 둔다).
// 2026-10-17 owner 요청: 앞으로 테스트가 더 생길 예정이라, 테스트 종류마다 화면 코드를 따로 만들지 않고
// "테스트 종류 하나 = 그룹 하나(제목 + 결과 목록 + 시작 링크)"로 같은 모양에 맞춰 내려준다.
export type TestResultItem = {
  id: string;
  createdAt: string;
  title: string;
  // 제목 옆의 작은 표시(예: "심층보고서", "리포트"). 없으면 표시하지 않는다.
  badge?: string;
  // 결과를 여는 곳. external이면 새 탭(다른 사이트), 아니면 이 앱 안의 경로.
  open: { label: string; href: string; external: boolean };
  // "대표 유형" 개념이 있는 테스트만 채운다(지금은 디저트 테스트). 없으면 대표 선택 버튼이 나오지 않는다.
  primary?: { isPrimary: boolean };
};

export type TestGroup = {
  key: string;
  title: string;
  // null이면 이 종류만 불러오지 못한 것(다른 종류는 그대로 보인다).
  items: TestResultItem[] | null;
  emptyMessage: string;
  start: { label: string; href: string };
};
