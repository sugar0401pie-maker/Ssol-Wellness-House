import { Gaegu } from "next/font/google";

// 손글씨 글꼴(Gaegu) — 작심삼일 스토리 카드의 메모와 도장 쾅 글자에만 쓴다(요청문 13-1장: 갓생러모임 화면 글자는 보통 글자).
// 앱에 같이 실려 나간다(next/font가 구글 글꼴 파일을 빌드 때 받아 우리 주소로 내보냄). 한글은 필요한 글자 묶음만 그때그때 받는다.
export const gaegu = Gaegu({ weight: ["400", "700"], subsets: ["latin"], display: "swap", preload: false });
