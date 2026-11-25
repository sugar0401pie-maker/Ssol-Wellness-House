import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBoardShell from "@/components/board/PublicBoardShell";
import ReaderView from "@/components/board/ReaderView";
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
  const f = await find(kind, id);
  if (!f) return { title: "고민 타파 | 쏠 웰니스 하우스" };
  const title = f.guide?.title ?? `고민우체국 ${f.episode?.n}화 — ${f.episode?.title}`;
  const description = f.guide ? f.guide.lines.join(" · ") : (f.episode?.summary ?? "");
  return { title: `${title} | 쏠 웰니스 하우스`, description, alternates: { canonical: `/board/${kind}/${id}` } };
}

export default async function PublicRead({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
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
