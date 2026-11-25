// 인스타그램·카카오톡 공유 버튼(대표님 2026-11-25: 각 서비스의 로고와 색으로). 로고는 선·면으로 그린 SVG(그림 파일 없음).
// 브랜드 색은 그 서비스의 것이라 밤하늘 토큰이 아니라 여기서만 쓴다.
const IG_BG = "linear-gradient(45deg,#f58529 0%,#dd2a7b 45%,#8134af 75%,#515bd4 100%)";
const KAKAO_YELLOW = "#FEE500";
const KAKAO_INK = "#191919";

export function InstagramButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-2 rounded-full py-3 text-[16px] font-bold disabled:opacity-50" style={{ background: IG_BG, color: "#fff" }}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
      인스타그램 스토리에 올리기
    </button>
  );
}

export function KakaoButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-2 rounded-full py-3 text-[16px] font-bold disabled:opacity-50" style={{ background: KAKAO_YELLOW, color: KAKAO_INK }}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill={KAKAO_INK} d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-.9 3.4c-.1.3.3.6.6.4l4-2.7c.4 0 .7.1 1.1.1 5 0 9-3.1 9-7s-4-7.1-9-7.1z" />
      </svg>
      카카오톡으로 공유하기
    </button>
  );
}
