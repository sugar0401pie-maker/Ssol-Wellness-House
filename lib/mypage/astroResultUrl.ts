// 쏠 점성술 하우스(astro.ssolwellnesshouse.com, 별도 저장소) 결과 상세 페이지 주소.
// 2026-10-17 owner 결정: 마이페이지에는 "결과가 있다"는 사실(목록)만 보이고, 세부 내용은 그 사이트의
// 결과 페이지로 바로 연결한다. 주소 형식은 점성술 앱의 "내 결과" 화면이 쓰는 것과 같다:
// /results/{결과 id}/{마지막으로 본 쪽 번호(없으면 1)}.
// 브라우저에서 쓰므로 server-only가 아니다.
export const ASTRO_SITE_URL = "https://astro.ssolwellnesshouse.com";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function astroResultUrl(id: string, lastPage: number | null | undefined): string {
  // id는 DB에서 오지만, 주소에 그대로 붙이는 값이라 형식이 어긋나면 안전하게 목록 화면으로 보낸다.
  if (!UUID.test(id)) return `${ASTRO_SITE_URL}/results`;
  const page = Number.isInteger(lastPage) && (lastPage as number) >= 1 ? (lastPage as number) : 1;
  return `${ASTRO_SITE_URL}/results/${id}/${page}`;
}
