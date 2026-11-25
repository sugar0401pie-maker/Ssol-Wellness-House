import Image from "next/image";
import ImageCarousel from "./ImageCarousel";
import { TAROT_NAME, TAROT_URL, promoFor, promoIndex } from "@/lib/board/promo";
import { tagHref } from "@/lib/board/tags";
import Link from "next/link";
import {
  episodeCover,
  episodeCut,
  STARTER_GUIDES,
  type Episode,
  type Guide,
} from "@/lib/board/data";

// 고민 가이드·고민우체국 글 한 편의 본문(요청문 v1.9.4 10-4·10-5장) — 앱 안 읽기(/worry/…)와 공개 게시판 읽기(/board/…)가 같이 쓴다.
// 본문 HTML은 서버가 허용한 태그만 남긴 것(lib/board/sanitize.ts). 공개 글의 대화 예시·만화·FAQ는 대표님이 정하기 전이라 본문과 "먼저 한 줄로"만.
// isPublic: 로그인 없이 보는 공개 게시판 — "가져와 보여 줘요" 안내를 빼고, "쏘웰라와 이야기하기"는 첫 화면(로그인·가입)으로.
export default function ReaderView({
  guide: g,
  episode: e,
  html,
  stale,
  isPublic,
}: {
  guide?: Guide;
  episode?: Episode;
  html: string | null;
  stale: boolean;
  isPublic: boolean;
}) {
  const url = g?.url ?? e?.url ?? "";
  const promo = promoFor(
    g
      ? promoIndex(
          "guide",
          g.slug,
          STARTER_GUIDES.map((x) => x.slug),
        )
      : promoIndex("post", e?.n ?? 0),
  );
  const carousel = e?.images && e.images.length > 0 ? e.images : null;
  const cover = e && !carousel ? (e.image ?? episodeCover(e.n)) : null;
  return (
    <>
      {carousel && (
        <ImageCarousel images={carousel} label={`고민우체국 ${e?.n}화 그림`} />
      )}
      {cover && (
        <Image
          src={cover}
          alt={`고민우체국 ${e?.n}화 표지`}
          width={720}
          height={900}
          unoptimized
          className="mt-2 h-auto w-full rounded-2xl"
        />
      )}
      <span className="mt-3 inline-block rounded-full bg-night-amber px-3 py-0.5 text-[12.5px] text-night-on-amber">
        {g ? `#${g.tag} · 고민 가이드` : `고민우체국 ${e?.n}화`}
      </span>
      <h1 className="mt-2 text-[22px] font-bold leading-snug">
        {g?.title ?? e?.title}
      </h1>
      {stale && (
        <p className="mt-1 text-[12px] text-night-yellow">
          지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.
        </p>
      )}

      <div className="mt-3 rounded-2xl bg-night-panel p-4">
        <b className="block text-[14px] text-night-yellow">
          {g ? "먼저 한 줄로" : "줄거리"}
        </b>
        {g ? (
          <ol className="mt-1.5 list-decimal pl-5 text-[15px] leading-7">
            {g.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-1.5 text-[15px] leading-7">{e?.summary}</p>
        )}
      </div>

      {html ? (
        // 서버에서 허용한 태그만 남긴 HTML(lib/board/sanitize.ts — 스크립트·이벤트 속성·바깥 주소 제거)
        <div
          className="ssol-article mt-5 text-[15px] leading-7 [&_a]:text-night-yellow [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-night-border [&_blockquote]:pl-3 [&_h2]:mt-5 [&_h2]:text-[18px] [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-bold [&_img]:my-3 [&_img]:rounded-xl [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mt-3 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-night-dim">
          {isPublic
            ? "전체 글은 준비하고 있어요. 곧 이 자리에 올라와요."
            : "전체 글은 쏠 웰니스 하우스 사이트에 올라오면 여기서 바로 볼 수 있어요."}
        </p>
      )}

      {/* 캐러셀이 있는 회차는 묶음 그림만 쓴다(대표님 2026-11-25 — 다른 그림을 덧붙이지 않음) */}
      {e && !carousel && (
        <Image
          src={episodeCut(e.n)}
          alt="답장을 쓰는 우체부"
          width={600}
          height={600}
          unoptimized
          className="mx-auto mt-5 h-auto w-[60%] rounded-2xl"
        />
      )}

      {!isPublic && (
        <p className="mt-5 text-[12.5px] leading-5 text-night-dim">
          로그인 없이 볼 수 있는 쏠 웰니스 하우스 사이트의 글을 가져와 보여
          줘요.
          <span className="mt-1 block select-all break-all text-night-soft">
            {url.replace(/^https:\/\//, "")}
          </span>
        </p>
      )}
      {e && (
        <p className="mt-3 text-[12.5px] text-night-dim">
          창작 이야기이며 실제 이용자 사연이 아니에요.
        </p>
      )}
      <p className="mt-3 text-[12.5px] leading-5 text-night-dim">
        이 글은 자기이해를 돕는 일반 정보예요. 의료적 진단이나 심리 치료를
        대신하지 않아요.
      </p>
      {/* 글마다 쏘웰라·쏠 타로 하우스 광고 문구(대표님 2026-11-25 — 운영 광고 문구를 글마다 다르게 돌려 가며) + 태그 40개 */}
      <section className="mt-6 rounded-2xl border border-night-line bg-night-panel p-4">
        <p className="text-[16px] font-bold leading-snug text-night-yellow">
          {promo.sowella.headline}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-night-sub">
          {promo.sowella.desc}
        </p>
        <a
          href={TAROT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2.5"
        >
          <span className="block text-[12px] text-night-amber">
            {TAROT_NAME}
          </span>
          <span className="block text-[14px] font-bold leading-snug">
            {promo.tarot.headline}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-5 text-night-sub">
            {promo.tarot.desc}
          </span>
        </a>
      </section>
      {(g?.tags ?? e?.tags ?? []).length > 0 && (
        <nav aria-label="태그" className="mt-4 flex flex-wrap gap-1.5">
          {(g?.tags ?? e?.tags ?? []).map((t) => (
            <Link
              key={t}
              href={tagHref(isPublic ? "/board" : "/worry", t)}
              className="rounded-full border border-night-line px-2.5 py-1 text-[12px] text-night-soft"
            >
              #{t}
            </Link>
          ))}
        </nav>
      )}
      <Link
        href={isPublic ? "/" : "/chat"}
        className="mt-5 block rounded-full bg-night-amber py-3 text-center text-[16px] font-bold text-night-on-amber"
      >
        쏘웰라와 이야기하기
      </Link>
    </>
  );
}
