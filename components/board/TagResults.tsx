import Link from "next/link";
import type { Episode, Guide } from "@/lib/board/data";
import { tagHref } from "@/lib/board/tags";

// 태그를 누르면 그 태그가 달린 고민 타파 글 모아 보기(대표님 2026-11-25). 앱 안(/worry/tag/…)과 공개 게시판(/board/tag/…)이 같이 쓴다.
export default function TagResults({
  tag,
  guides,
  episodes,
  basePath,
}: {
  tag: string;
  guides: Guide[];
  episodes: Episode[];
  basePath: string;
}) {
  const g = guides.filter((x) => x.tags?.includes(tag));
  const e = episodes.filter((x) => x.tags?.includes(tag));
  return (
    <>
      <span className="inline-block rounded-full bg-night-amber px-3 py-0.5 text-[12.5px] text-night-on-amber">
        태그
      </span>
      <h1 className="mt-2 text-[22px] font-bold">#{tag}</h1>
      <p className="mt-1 text-[13px] text-night-sub">
        이 태그가 달린 글 {g.length + e.length}편
      </p>
      {g.length + e.length === 0 && (
        <p className="mt-6 text-[14px] text-night-dim">
          아직 이 태그가 달린 글이 없어요.
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {e.map((x) => (
          <Link
            key={`p${x.n}`}
            href={`${basePath}/post/${x.n}`}
            className="rounded-2xl border border-night-line bg-night-panel px-4 py-3"
          >
            <span className="text-[12px] text-night-amber">
              고민우체국 {x.n}화
            </span>
            <b className="mt-0.5 block text-[15px] leading-snug">{x.title}</b>
          </Link>
        ))}
        {g.map((x) => (
          <Link
            key={x.slug}
            href={`${basePath}/guide/${x.slug}`}
            className="rounded-2xl border border-night-line bg-night-panel px-4 py-3"
          >
            <span className="text-[12px] text-night-amber">
              #{x.tag} · 고민 가이드
            </span>
            <b className="mt-0.5 block text-[15px] leading-snug">{x.title}</b>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-[12px] text-night-dim">
        다른 태그도 둘러보세요:{" "}
        {["고민우체국", "고민가이드", "썸", "이직", "MBTI", "타로"]
          .filter((t) => t !== tag)
          .map((t, i) => (
            <span key={t}>
              {i > 0 && " · "}
              <Link
                href={tagHref(basePath, t)}
                className="text-night-soft underline underline-offset-2"
              >
                #{t}
              </Link>
            </span>
          ))}
      </p>
    </>
  );
}
