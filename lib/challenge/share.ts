"use client";
// 스토리 카드 내보내기(대표님 2026-11-25: 인스타그램·카카오톡 버튼을 1·2·3일차 카드마다).
// 웹 화면에서는 인스타그램 스토리 편집 화면에 그림을 바로 넣을 방법이 없다(인스타그램이 앱에만 열어 둔 기능).
// 그래서 휴대폰의 공유 창으로 그림을 넘긴다 — 공유 창에서 인스타그램을 누르면 그 그림이 들어간 채로 스토리·게시물 화면이 열린다.
// 공유 창이 없는 기기(PC 등)는 그림을 내려받고 인스타그램을 새 창으로 연다.
// 카카오톡: 카카오 JavaScript 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 있으면 카카오 공유(그림 올림 → 카카오톡 친구 고르기), 없으면 공유 창.

export function downloadBlob(b: Blob, fileName: string): boolean {
  try {
    const a = document.createElement("a");
    if (!("download" in a)) return false;
    a.href = URL.createObjectURL(b);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch {
    return false;
  }
}

async function shareSheet(b: Blob, fileName: string): Promise<boolean> {
  try {
    const file = new File([b], fileName, { type: b.type || "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    // 사용자가 공유 창을 닫은 것도 "열렸다"로 본다(올렸는지는 앱이 알 수 없음)
    return (e as Error)?.name === "AbortError";
  }
}

export async function shareToInstagram(b: Blob, fileName: string): Promise<void> {
  if (await shareSheet(b, fileName)) return;
  downloadBlob(b, fileName);
  window.open("https://www.instagram.com/", "_blank", "noopener");
}

type KakaoSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: {
    uploadImage: (o: { file: File[] }) => Promise<{ infos: { original: { url: string } } }>;
    sendDefault: (o: unknown) => void;
  };
};
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

function loadKakao(): Promise<KakaoSDK | null> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return Promise.resolve(null);
  const w = window as unknown as { Kakao?: KakaoSDK };
  const ready = () => {
    if (w.Kakao && !w.Kakao.isInitialized()) w.Kakao.init(key);
    return w.Kakao ?? null;
  };
  if (w.Kakao) return Promise.resolve(ready());
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = KAKAO_SDK;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(ready());
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export async function shareToKakao(b: Blob, fileName: string, info: { title: string; description: string; url: string }): Promise<void> {
  const K = await loadKakao().catch(() => null);
  if (K) {
    try {
      const up = await K.Share.uploadImage({ file: [new File([b], fileName, { type: b.type || "image/png" })] });
      K.Share.sendDefault({
        objectType: "feed",
        content: { title: info.title, description: info.description, imageUrl: up.infos.original.url, link: { mobileWebUrl: info.url, webUrl: info.url } },
        buttons: [{ title: "쏘웰라에서 함께해요", link: { mobileWebUrl: info.url, webUrl: info.url } }],
      });
      return;
    } catch {
      /* 아래 공유 창으로 */
    }
  }
  if (!(await shareSheet(b, fileName))) downloadBlob(b, fileName);
}
