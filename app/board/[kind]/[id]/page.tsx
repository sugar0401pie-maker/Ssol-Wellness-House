import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBoardShell from "@/components/board/PublicBoardShell";
import ReaderView from "@/components/board/ReaderView";
import TagResults from "@/components/board/TagResults";
import { episodeUrl } from "@/lib/board/data";
import { articleFor, loadEpisodes, loadGuides } from "@/lib/board/fetchSite";

// 고민 타파 공개 게시판의 글 읽기(/board/guide/<slug> · /board/post/<회차>) — 앱 안 읽기 화면과 같은 구성(ReaderView).
export const revalidate = 1800;

async function find(kind: string, id: string) {
  if (kind === "guide") {
    const list = await loadGuides();
    const guide = list.data.find((g) => g.slug === id);
    return guide ? { guide, url: guide.url, bodyHtml: guide.bodyHtml, stale: list.stale } : null;
  }
  if (kind === "post") {
    const list = await loadEpisodes();
    const episode = list.data.find((e) => String(e.n) === id);
    return episode ? { episode, url: episode.url, bodyHtml: episode.bodyHtml, stale: list.stale } : null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string; id: string }> }): Promise<Metadata> {
  const { kind, id } = await params;
  // 태그 모아 보기는 얇은 쪽이 많아 검색 결과에는 올리지 않고(noindex) 링크만 따라가게 한다
  if (kind === "tag") return { title: `#${decodeURIComponent(id)} | 고민 타파 | 쏠 웰니스 하우스`, robots: { index: false, follow: true } };
  const f = await find(kind, id);
  if (!f) return { title: "고민 타파 | 쏠 웰니스 하우스" };
  const title = f.guide?.title ?? `고민우체국 ${f.episode?.n}화 — ${f.episode?.title}`;
  const description = f.guide ? f.guide.lines.join(" · ") : (f.episode?.summary ?? "");
  // 고민우체국 글의 검색 원본은 공개 사이트(www/postoffice/<회차>) — 같은 글이 두 곳에 있어 한 곳만 원본으로(대표님 2026-11-26)
  const canonical = f.episode ? episodeUrl(f.episode.n) : `/board/${kind}/${id}`;
  return { title: `${title} | 쏠 웰니스 하우스`, description, alternates: { canonical } };
}

export default async function PublicRead({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind === "tag") {
    const [guides, episodes] = await Promise.all([loadGuides(), loadEpisodes()]);
    return (
      <PublicBoardShell>
        <div className="px-5 pb-8 pt-3">
          <Link href="/board" className="inline-block py-2 text-[15px] text-night-soft">
            ‹ 고민 타파로 돌아가기
          </Link>
          <TagResults tag={decodeURIComponent(id)} guides={guides.data} episodes={episodes.data} basePath="/board" />
        </div>
      </PublicBoardShell>
    );
  }
  const f = await find(kind, id);
  if (!f) notFound();
  const a = await articleFor(f);
  return (
    <PublicBoardShell>
      <div className="px-5 pb-8 pt-3">
        <Link href="/board" className="inline-block py-2 text-[15px] text-night-soft">
          ‹ 고민 타파로 돌아가기
        </Link>
        <ReaderView guide={"guide" in f ? f.guide : undefined} episode={"episode" in f ? f.episode : undefined} html={a.html} stale={a.stale || f.stale} isPublic />
      </div>
    </PublicBoardShell>
  );
}
