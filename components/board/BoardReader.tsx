"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { episodeCover, episodeCut, type Episode, type Guide } from "@/lib/board/data";

// 글 읽기 화면(요청문 v1.9.4 10-4·10-5장). 하단 메뉴는 숨긴다(BottomNav가 /worry/… 에서 숨김).
// 본문은 공개 사이트 글을 허용한 태그만 남겨 보여 준다(서버가 거른 HTML). 공개 글의 대화 예시·만화·FAQ는 대표님이 정하기 전이라 본문과 "먼저 한 줄로"만.
// 원래 주소는 글자로(링크로 바꿀지는 정해야 함 — 링크면 로그인 흐름 밖으로 나감).

type Payload = { kind: "guide" | "post"; guide?: Guide; episode?: Episode; html: string | null; stale: boolean };

export default function BoardReader({ kind, id, getToken = getAccessToken }: { kind: "guide" | "post"; id: string; getToken?: () => Promise<string | null> }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("login");
        const res = await fetch(`/api/board/article?kind=${kind}&id=${encodeURIComponent(id)}`, { headers: authHeaders(token), cache: "no-store" });
        const j = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "error");
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError((e as Error).message === "글을 찾지 못했어요." ? "글을 찾지 못했어요." : "지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, [kind, id]);

  const g = data?.guide;
  const e = data?.episode;
  const url = g?.url ?? e?.url ?? "";
  const cover = e ? (e.image ?? episodeCover(e.n)) : null;

  return (
    <div className="h-full overflow-y-auto bg-[image:var(--sky-text-bg)] text-night-text">
      <div className="mx-auto max-w-md px-5 pb-12 pt-4">
        <Link href="/worry" className="inline-block py-2 text-[15px] text-night-soft">
          ‹ 고민 타파로 돌아가기
        </Link>
        {error && <p className="mt-6 text-[14px] text-night-yellow">{error}</p>}
        {!data && !error && <p className="mt-6 text-[14px] text-night-dim">불러오는 중…</p>}

        {data && (
          <>
            {cover && <Image src={cover} alt={`고민우체국 ${e?.n}화 표지`} width={720} height={900} unoptimized className="mt-2 h-auto w-full rounded-2xl" />}
            <span className="mt-3 inline-block rounded-full bg-night-amber px-3 py-0.5 text-[12.5px] text-night-on-amber">{g ? `#${g.tag} · 고민 가이드` : `고민우체국 ${e?.n}화`}</span>
            <h1 className="mt-2 text-[22px] font-bold leading-snug">{g?.title ?? e?.title}</h1>
            {data.stale && <p className="mt-1 text-[12px] text-night-yellow">지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.</p>}

            <div className="mt-3 rounded-2xl bg-night-panel p-4">
              <b className="block text-[14px] text-night-yellow">{g ? "먼저 한 줄로" : "줄거리"}</b>
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

            {data.html ? (
              // 서버에서 허용한 태그만 남긴 HTML(lib/board/sanitize.ts — 스크립트·이벤트 속성·바깥 주소 제거)
              <div
                className="ssol-article mt-5 text-[15px] leading-7 [&_a]:text-night-yellow [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-night-border [&_blockquote]:pl-3 [&_h2]:mt-5 [&_h2]:text-[18px] [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-bold [&_img]:my-3 [&_img]:rounded-xl [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mt-3 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: data.html }}
              />
            ) : (
              <p className="mt-4 text-[13px] leading-6 text-night-dim">전체 글은 쏠 웰니스 하우스 사이트에 올라오면 여기서 바로 볼 수 있어요.</p>
            )}

            {e && <Image src={episodeCut(e.n)} alt="답장을 쓰는 우체부" width={600} height={600} unoptimized className="mx-auto mt-5 h-auto w-[60%] rounded-2xl" />}

            <p className="mt-5 text-[12.5px] leading-5 text-night-dim">
              로그인 없이 볼 수 있는 쏠 웰니스 하우스 사이트의 글을 가져와 보여 줘요.
              <span className="mt-1 block select-all break-all text-night-soft">{url.replace(/^https:\/\//, "")}</span>
            </p>
            {e && <p className="mt-3 text-[12.5px] text-night-dim">창작 이야기이며 실제 이용자 사연이 아니에요.</p>}
            <p className="mt-3 text-[12.5px] leading-5 text-night-dim">이 글은 자기이해를 돕는 일반 정보예요. 의료적 진단이나 심리 치료를 대신하지 않아요.</p>
            <Link href="/chat" className="mt-5 block rounded-full bg-night-amber py-3 text-center text-[16px] font-bold text-night-on-amber">
              쏘웰라와 이야기하기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
