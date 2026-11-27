// 검색엔진 안내(robots.txt · sitemap.xml)가 같이 쓰는 주소 목록. 한 곳에 두어 "사이트맵에 올린 주소를 robots가 막는" 모순이 생기지 않게 한다(paths.test.ts가 확인).
export const SITE_URL = "https://app.ssolwellnesshouse.com";

// 메인 사이트(정적 페이지)의 쏘웰라 상세 소개. 앱의 /about(요약판)은 검색엔진에 이 주소를 원본(canonical)으로 알린다.
export const MAIN_SITE_ABOUT_URL = "https://www.ssolwellnesshouse.com/about.html";

// 링크 공유(카카오톡 등) 미리보기 이미지. 레이아웃과 /about이 같이 쓴다(페이지가 openGraph를 따로 지정하면 레이아웃 값이 덮어써지므로 이미지도 다시 넣어야 한다).
// 2026-11-27 대표님: 쏘웰라 밖에 공유할 때 손글씨 배너("프로 갓생러들의 비밀, 쏘웰라 AI", 1200×628 다섯 장)가 뜨게 — 화면에 맞는 장면을 고름
// (기본 = 친구들과 풍등 기념사진 · 풍등 = 물가의 풍등 · 사운드 배스 = 숲속 사운드배스 · 갓생러모임 = 새싹을 함께 돌보기 · 쏠 타로 소개 = 함께 타로 살펴보기).
const BANNER_ALT = "프로 갓생러들의 비밀, 쏘웰라 AI";
const banner = (name: string) => ({ url: `/og/${name}.jpg`, width: 1200, height: 628, alt: BANNER_ALT });
export const SHARE_IMAGES = {
  friends: banner("friends"),
  lantern: banner("lantern"),
  soundbath: banner("soundbath"),
  growth: banner("growth"),
  tarot: banner("tarot"),
} as const;
export type ShareImageKey = keyof typeof SHARE_IMAGES;
export const SHARE_IMAGE = SHARE_IMAGES.friends;

// 로그인 없이 볼 수 있는 페이지만. 홈("/")은 로그아웃 상태에서 소개 화면을 보여 준다.
// 2026-11-25: 고민 타파 공개 게시판(/board) 추가 — 글 주소는 sitemap.ts가 목록에서 덧붙인다.
export const PUBLIC_PATHS = ["/", "/signup", "/legal", "/board"] as const;

// 로그인 뒤의 화면·내 정보·결제 결과·서버 주소. 이 안에는 개인 데이터가 있어 검색엔진이 들어오지 않게 한다.
// (막는 것은 "수집하지 마세요"라는 안내일 뿐이고, 실제 보호는 로그인·서버 권한 검사가 맡는다.)
export const PRIVATE_PATHS = ["/api/", "/home", "/chat", "/mypage", "/report/", "/session-reserve", "/pricing/success", "/pricing/fail", "/admin", "/challenge", "/worry", "/lantern", "/soundbath", "/login", "/onboarding"] as const; // 2026-11-25: 갓생러모임·앱 안 고민 타파·풍등·사운드 배스(로그인 뒤)
