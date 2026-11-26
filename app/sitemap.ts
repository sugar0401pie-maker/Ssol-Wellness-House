import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/seo/paths";
import { STARTER_GUIDES } from "@/lib/board/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency: path === "/legal" ? "monthly" : "weekly",
    priority: path === "/" ? 1 : 0.5,
  }));
  // 고민 타파 공개 게시판의 글(2026-11-25). 공개 사이트 목록이 생기면 거기 글도 같은 주소 규칙(/board/guide/<slug>)으로 보인다.
  // 고민우체국 글은 검색 원본이 공개 사이트(www/postoffice)라 여기 사이트맵에는 넣지 않는다(대표님 2026-11-26).
  const board: MetadataRoute.Sitemap = STARTER_GUIDES.map((g) => ({ url: `${SITE_URL}/board/guide/${g.slug}`, changeFrequency: "weekly" as const, priority: 0.4 }));
  return [...pages, ...board];
}
