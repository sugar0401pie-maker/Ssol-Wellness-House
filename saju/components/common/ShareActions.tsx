"use client";
import { useState } from "react";

// 결과 공유하기 — 카카오톡으로 바로 공유(노란 버튼, ui_copy.share.button_style).
// 카카오 JavaScript 키(NEXT_PUBLIC_KAKAO_JS_KEY, 쏘웰라와 같은 이름)가 있고 Kakao Developers에 saju 도메인이 등록돼 있어야 한다.
// 키가 없거나 카카오가 안 열리면 기기 공유 창, 그것도 안 되면 링크 복사.
// 공유되는 것: 살 이름 + 문구 + 테스트 그림 + 이 공유 화면 주소. 닉네임·고민·생년월일은 넣지 않는다.
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"; // 쏘웰라(메인 앱)와 같은 판

type KakaoSDK = { isInitialized: () => boolean; init: (key: string) => void; Share: { sendDefault: (o: unknown) => void } };

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

type Props = { url: string; title: string; description: string; imageUrl: string; buttonTitle: string; label: string; note: string };

export default function ShareActions({ url, title, description, imageUrl, buttonTitle, label, note }: Props) {
  const [done, setDone] = useState(false);

  async function share() {
    const K = await loadKakao().catch(() => null);
    if (K) {
      try {
        K.Share.sendDefault({
          objectType: "feed",
          content: { title, description, imageUrl, link: { mobileWebUrl: url, webUrl: url } },
          buttons: [{ title: buttonTitle, link: { mobileWebUrl: url, webUrl: url } }],
        });
        return;
      } catch {
        /* 아래 기기 공유 창으로 */
      }
    }
    try {
      if (navigator.share) {
        await navigator.share({ title, text: description, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      /* 사용자가 공유 창을 닫은 경우 */
    }
  }

  return (
    <>
      <button className="btn kakao" onClick={share}>
        <span className="klogo" aria-hidden />
        {label}
      </button>
      <p className="hint">{done ? "링크를 복사했어요." : note}</p>
    </>
  );
}
