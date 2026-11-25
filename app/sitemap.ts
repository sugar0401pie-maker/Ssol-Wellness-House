import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/seo/paths";
import { STARTER_EPISODES, STARTER_GUIDES, isPublishedOn } from "@/lib/board/data";
import { todayKeyKST } from "@/lib/safety/dailyLimit";

// 고민우체국 예약 게시가 날짜마다 늘어나서 한 시간마다 새로 만든다.
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency: path === "/legal" ? "monthly" : "weekly",
    priority: path === "/" ? 1 : 0.5,
  }));
  // 고민 타파 공개 게시판의 글(2026-11-25). 공개 사이트 목록이 생기면 거기 글도 같은 주소 규칙(/board/guide/<slug>)으로 보인다.
  const board: MetadataRoute.Sitemap = [
    ...STARTER_GUIDES.map((g) => ({ url: `${SITE_URL}/board/guide/${g.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...STARTER_EPISODES.filter((e) => isPublishedOn(e, todayKeyKST())).map((e) => ({ url: `${SITE_URL}/board/post/${e.n}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
  return [...pages, ...board];
}
