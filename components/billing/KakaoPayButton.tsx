// 카카오페이 결제 버튼(2026-11-18 대표님 지정): 카카오페이 노란 바탕(#FFEB00)에 검정 글자, 문구 앞에 카카오페이 표시(검정 말풍선 + pay).
// 버튼 아래 작은 글씨로 약관 동의 안내 — 결제 버튼을 누르는 것으로 동의를 대신한다(체크 칸 없음, 대표님 결정).
export function KakaoPayMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 24" aria-hidden="true" className={className}>
      <path d="M11 3C5.5 3 1 6.5 1 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.7c-.1.4.3.7.6.5l4.3-2.9c.5.1 1 .1 1.4.1 5.5 0 10-3.5 10-7.9S16.5 3 11 3z" fill="#191919" />
      <text x="25" y="17" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="700" fill="#191919">pay</text>
    </svg>
  );
}

export default function KakaoPayButton({ label, onClick, busy, disabled }: { label: string; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FFEB00] text-sm font-medium text-[#191919] disabled:opacity-50"
      >
        {busy ? (
          "카카오페이로 이동하는 중…"
        ) : (
          <>
            <KakaoPayMark className="h-[18px] w-auto" />
            <span>{label}</span>
          </>
        )}
      </button>
      <p className="mt-1.5 text-center text-[11px] leading-4 text-slate-400">
        결제 시 쏠 웰니스 하우스{" "}
        <a href="/legal#terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          이용약관
        </a>
        과{" "}
        <span className="whitespace-nowrap">
          <a href="/legal#privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            개인정보 처리방침
          </a>
          에 동의합니다.
        </span>
      </p>
    </div>
  );
}
