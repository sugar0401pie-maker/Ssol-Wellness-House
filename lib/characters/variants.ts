// 홈 탭/심층보고서의 캐릭터 이미지는 유형별 고정 1장이 아니라 public/characters/<code>/1.png ~ N.png 중에서
// 매번 무작위로 하나를 보여준다(2026-10-01 owner 요청). 기본은 5장(owner가 준 75장 세트)이고,
// 2026-10-15 owner 요청으로 캐릭터 단독 그림을 추가한 유형은 6장이다 — 유형마다 장수가 다를 수 있으므로
// 추가 그림이 들어간 유형만 아래 표에 장수를 적는다(그림 파일을 넣고 이 표를 같이 고쳐야 한다. 파일이 없는
// 번호가 뽑히면 이미지가 깨지므로 variants.test.ts가 "표의 장수만큼 파일이 실제로 있는지" 확인한다).
export const DEFAULT_VARIANT_COUNT = 5;

export const VARIANT_COUNTS: Record<string, number> = {
  affogato: 6, // 우체국 답장(아포가토)
  berrycheesecake: 6, // 물 주는 장면
  berrysorbet: 6, // 휴대폰 보는 장면
  brownie: 6, // 우체국 답장(에스프레소 브라우니)
  croissant: 6, // 길 위를 걷는 장면
  madeleine: 6, // 화분에 물 주는 장면
  meringue: 6, // 우체국 답장(머랭)
};

export function variantCount(code: string | null | undefined): number {
  return (code && VARIANT_COUNTS[code]) || DEFAULT_VARIANT_COUNT;
}

// 화면이 열릴 때 한 번 [0,1) 난수를 뽑아 두고, 유형(code)이 정해지면 그 유형의 장수에 맞춰 번호로 바꾼다
// (유형은 서버에서 받아온 뒤에야 알 수 있어서, 난수와 번호 계산을 나눴다). 양쪽 화면(HomeTab, ReportDetailPage)이
// 독립적으로 뽑아서 서로 다른 변형이 나올 수 있다(owner가 명시적으로 원한 동작).
export function randomSeed(): number {
  return Math.random();
}

export function variantFor(code: string | null | undefined, seed: number): number {
  const n = variantCount(code);
  const i = Math.floor(Math.min(Math.max(seed, 0), 0.999999999) * n);
  return 1 + i;
}
