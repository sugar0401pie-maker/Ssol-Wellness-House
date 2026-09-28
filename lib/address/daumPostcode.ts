"use client";

// Daum(카카오) 우편번호 서비스 — 무료, API 키 없이 스크립트만 불러오면 쓸 수 있는 표준
// 도로명 주소 검색. 문서: https://postcode.map.daum.net/guide
// 스크립트를 한 번만 불러오고(중복 삽입 방지), 팝업에서 고른 결과를 Promise로 돌려준다.
//
// 2026-09-28 버그 수정(owner 실기기 확인: "주소 도로명 선택하고나면 갑자기 창이 날아가버림"):
// 예전엔 `new daum.Postcode({...}).open()`으로 별도 브라우저 창을 띄웠는데, iOS Safari는
// `window.open()`이 클릭 이벤트 핸들러 안에서 "동기적으로" 호출되지 않으면(여기선 스크립트
// 로딩을 기다리는 await가 그 사이에 끼어 있었다) 사용자가 직접 연 창으로 인정하지 않고 팝업을
// 막거나, 심하면 현재 페이지 자체를 이동시켜버린다 — 실제로 겪은 "화면이 날아간다" 증상과
// 정확히 일치한다. `.open()`(새 창) 대신 `.embed()`(우리가 만든 작은 오버레이 안에 그대로
// 끼워 넣기)를 쓰면 애초에 브라우저 창/팝업을 전혀 안 만들어서 이 문제 자체가 없어진다.
const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeResult) => void;
        width?: string | number;
        height?: string | number;
      }) => { embed: (container: HTMLElement) => void };
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

// 화면 위에 작은 오버레이를 직접 만들고 그 안에 주소 검색을 끼워 넣는다(별도 창 없음).
// 사용자가 하나를 고르면 그 주소(우편번호 포함)로 resolve, 닫기를 누르거나 바깥을 탭하면
// 그냥 오버레이만 닫는다(에러 아님 — 조용히 취소된 상태로 남는다, 기존과 같은 동작).
export async function openAddressSearch(): Promise<{ address: string; zonecode: string }> {
  await loadScript();
  if (!window.daum?.Postcode) throw new Error("주소 검색 서비스를 불러오지 못했어요.");

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(10,20,30,.4);display:flex;align-items:center;justify-content:center;padding:16px;";

    // 2026-09-28 버그 수정: 패널에 max-height만 주고 컨테이너를 flex:1로 두면, Daum
    // Postcode가 iframe 높이를 잴 때 컨테이너의 실제 높이가 아직 0이라(부모 높이가
    // max-height만 있어 불확정) iframe이 height:0으로 생성되며 아무것도 안 보였다.
    // 패널 자체에 확정된 height를 줘서 이 문제를 없앤다.
    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;border-radius:16px;overflow:hidden;width:min(94vw,420px);height:min(85vh,560px);display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.25);";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #DDD6CA;";
    const title = document.createElement("span");
    title.textContent = "주소 검색";
    title.style.cssText = "font-size:15px;font-weight:500;color:#1B2733;";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "닫기";
    closeBtn.style.cssText = "background:none;border:0;font-size:13px;color:#56616C;padding:4px 6px;cursor:pointer;";
    header.appendChild(title);
    header.appendChild(closeBtn);

    const container = document.createElement("div");
    container.style.cssText = "flex:1;min-height:420px;";

    panel.appendChild(header);
    panel.appendChild(container);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function cleanup() {
      overlay.remove();
    }
    closeBtn.onclick = cleanup;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup();
    });

    new window.daum!.Postcode({
      oncomplete: (data) => {
        cleanup();
        resolve({ address: data.roadAddress || data.jibunAddress, zonecode: data.zonecode });
      },
      width: "100%",
      height: "100%",
    }).embed(container);
  });
}
