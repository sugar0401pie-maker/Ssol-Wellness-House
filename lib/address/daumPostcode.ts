"use client";

// Daum(카카오) 우편번호 서비스 — 무료, API 키 없이 스크립트만 불러오면 쓸 수 있는 표준
// 도로명 주소 검색 팝업. 문서: https://postcode.map.daum.net/guide
// 스크립트를 한 번만 불러오고(중복 삽입 방지), 팝업에서 고른 결과를 Promise로 돌려준다.

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: DaumPostcodeResult) => void }) => { open: () => void };
    };
  }
}

type DaumPostcodeResult = {
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
};

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  if (window.daum?.Postcode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("주소 검색 서비스를 불러오지 못했어요."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// 도로명 주소 검색 팝업을 열고, 사용자가 하나를 고르면 그 주소(우편번호 포함)로 resolve한다.
// 팝업을 닫아버리는 경우는 별도 이벤트가 없어 그냥 기다리는 상태로 남는다(호출부에서 취소
// 버튼 등으로 UX를 보완).
export async function openAddressSearch(): Promise<{ address: string; zonecode: string }> {
  await loadScript();
  if (!window.daum?.Postcode) throw new Error("주소 검색 서비스를 불러오지 못했어요.");

  return new Promise((resolve) => {
    new window.daum!.Postcode({
      oncomplete: (data) => {
        resolve({ address: data.roadAddress || data.jibunAddress, zonecode: data.zonecode });
      },
    }).open();
  });
}
