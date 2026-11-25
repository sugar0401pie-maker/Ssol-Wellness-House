// 카카오·네이버 로그인 버튼의 공식 로고(대표님 2026-11-25 "카카오로/네이버로 로그인에 공식 로고 각각 넣어주길").
// 각 회사 로그인 디자인 가이드의 심볼 모양(카카오: 검은 말풍선, 네이버: 흰 N)을 그림 파일 없이 SVG로 그린다.
export function KakaoSymbol({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#000" d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-.9 3.4c-.1.3.3.6.6.4l4-2.7c.4 0 .7.1 1.1.1 5 0 9-3.1 9-7s-4-7.1-9-7.1z" />
    </svg>
  );
}

export function NaverSymbol({ className = "h-[14px] w-[14px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#fff" d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z" />
    </svg>
  );
}
