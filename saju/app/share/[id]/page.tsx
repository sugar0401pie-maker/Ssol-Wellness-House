import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { uiCopy, fill } from "@/lib/engine";
import { getResult, isResultId } from "@/lib/store";
import { testName, BANNER_FILE } from "@/lib/tests";
import type { StoredResult } from "@/lib/types";
import ShareActions from "@/components/common/ShareActions";

// /share/{결과 번호} — 공유받은 사람이 여는 화면. 친구 정보는 살 이름만(닉네임·고민·생년월일·달력 없음, ui_copy.share.image_rule).
// 결제 전 결과는 1위 살이 유료라 2위 살을 보여 준다.
function salOf(r: StoredResult): { name: string; easy: string } | null {
  const cards = (r.page.cards ?? []) as { name: string }[];
  const card = r.paid ? cards[0] : cards[1];
  if (!card) return null;
  return { name: card.name, easy: r.page.sals?.[card.name]?.easy ?? "" };
}

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const r = isResultId(id) ? await getResult(id) : null;
  const s = r && salOf(r);
  const c = uiCopy().share;
  return { title: s ? fill(c.kakao_title, { sal: s.name }) : "살로 풀어보는 2027년", description: c.kakao_desc, robots: { index: false } };
}

export default async function SharePage({ params }: P) {
  const { id } = await params;
  const r = isResultId(id) ? await getResult(id) : null;
  if (!r) notFound();
  const s = salOf(r);
  const c = uiCopy();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://saju.ssolwellnesshouse.com";
  return (
    <div className="pg center" style={{ paddingTop: 32 }}>
      <p className="sub">{c.tests[testName(r.slug)].title}</p>
      {s && (
        <div className="bigsal flip">
          <span>{s.name}</span>
          <small>{s.easy}</small>
        </div>
      )}
      <p className="pre">{c.share.kakao_desc}</p>
      <Link className="btn" href={`/${r.slug}`} style={{ textDecoration: "none" }}>
        {c.share.kakao_button}
      </Link>
      <div className="mt">
        <ShareActions
          url={`${site}/share/${r.id}`}
          title={s ? fill(c.share.kakao_title, { sal: s.name }) : c.tests[testName(r.slug)].title}
          description={c.share.kakao_desc}
          imageUrl={`${site}${BANNER_FILE[r.slug]}`}
          buttonTitle={c.share.kakao_button}
          label={c.share.button}
          note={c.share.sheet_note}
        />
      </div>
    </div>
  );
}
