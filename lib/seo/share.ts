import type { Metadata } from "next";
import { SHARE_IMAGES, type ShareImageKey } from "./paths.ts";
import { OG_DESCRIPTION, OG_TITLE } from "./siteCopy.ts";

// 화면별 링크 공유 미리보기(배너 장면만 바꾸고 제목·설명은 사이트 공통). 페이지·레이아웃이 openGraph를 지정하면 위 레이아웃 값을 통째로 덮으므로
// 제목·설명도 함께 넣는다(2026-11-27 대표님 — 공유할 때 손글씨 배너).
export function shareMetadata(key: ShareImageKey, copy: { title?: string; description?: string } = {}): Pick<Metadata, "openGraph" | "twitter"> {
  const img = SHARE_IMAGES[key];
  const title = copy.title ?? OG_TITLE;
  const description = copy.description ?? OG_DESCRIPTION;
  return {
    openGraph: { title, description, siteName: "쏠 웰니스 하우스", locale: "ko_KR", type: "website", images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [img.url] },
  };
}
