// 검색엔진 안내(robots.txt · sitemap.xml)가 같이 쓰는 주소 목록. 한 곳에 두어 "사이트맵에 올린 주소를 robots가 막는" 모순이 생기지 않게 한다(paths.test.ts가 확인).
export const SITE_URL = "https://app.ssolwellnesshouse.com";

// 로그인 없이 볼 수 있는 페이지만. 홈("/")은 로그아웃 상태에서 소개 화면을 보여 준다.
export const PUBLIC_PATHS = ["/", "/signup", "/legal"] as const;

// 로그인 뒤의 화면·내 정보·결제 결과·서버 주소. 이 안에는 개인 데이터가 있어 검색엔진이 들어오지 않게 한다.
// (막는 것은 "수집하지 마세요"라는 안내일 뿐이고, 실제 보호는 로그인·서버 권한 검사가 맡는다.)
export const PRIVATE_PATHS = ["/api/", "/home", "/chat", "/mypage", "/report/", "/session-reserve", "/pricing/success", "/pricing/fail"] as const;
