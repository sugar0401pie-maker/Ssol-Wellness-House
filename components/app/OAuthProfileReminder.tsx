"use client";

// 2026-10-01 owner 요청: 카카오/네이버 가입자가 추가 정보(이름·생년월일)를 안 채워도 서비스를
// 그냥 쓸 수 있게 바뀌었다 — 대신 매번(단, "오늘 하루 보지 않기" 선택 시 오늘은 제외) 이 작은
// 리마인더를 먼저 보여주고, "확인"을 눌러야 실제 입력 폼(OAuthProfileGate)이 뜬다.
// 모든 팝업은 우측 상단에 닫기 버튼이 있어야 한다는 owner의 하드룰을 따른다.
export default function OAuthProfileReminder({
  onConfirm,
  onDismissToday,
  onClose,
}: {
  onConfirm: () => void;
  onDismissToday: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-1.5 -mt-1.5 rounded-full px-2 py-1 text-[12px] text-slate-400">
            닫기
          </button>
        </div>
        <p className="text-center text-[15px] leading-7 text-foreground">
          쏘웰라에게 당신에 대해 조금만 더 알려주세요.
          <br />
          <br />
          1분만 시간내서 추가 정보를 작성해주시겠어요?
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 h-11 w-full rounded-xl bg-navy text-[14px] font-medium text-white"
        >
          확인
        </button>
        <button type="button" onClick={onDismissToday} className="mt-2 h-9 w-full text-[13px] text-slate-500">
          오늘 하루 보지 않기
        </button>
      </div>
    </div>
  );
}
