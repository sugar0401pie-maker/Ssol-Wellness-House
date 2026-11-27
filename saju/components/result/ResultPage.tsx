import "server-only";
import { notFound, redirect } from "next/navigation";
import "./result.css";
import { getResult, isResultId } from "@/lib/store";
import { uiCopy, priceNow, feedManifest } from "./copy";
import { fill } from "@/lib/text";
import { FEED_GROUP, testName, type TestName } from "@/lib/tests";
import { keyAt, pickFeed, isDecisionAnswer, seededShuffle, hashString } from "@/lib/resultView";
import { PageHead, PageNav, FeedImage, ShareBar, Foot } from "./parts";
import { PayBox, BlurTeaser } from "./Locked";
import { P1, P2, P3, P3b, P3c, P7, SalPage, P5, P8, P8b, P9, P10, type Ctx } from "./pages";
import { Md } from "./Md";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 결과 한 쪽(/result/{id}/{n}, /result/{id}/sal/{1|2|3}).
 * 결제 가림(설계 문서 5장): 1~free_pages쪽은 무료. 그 뒤 쪽은 paid가 false면 이용자 결과를 그리지도 보내지도 않는다 —
 * 쪽 제목, 쪽 예고(ui_copy), 흐린 가상 예시(ui_copy.blur.samples), 결제 상자만.
 */
export default async function ResultPage({ id, n, opened }: { id: string; n: number; opened: boolean }) {
  if (!isResultId(id)) notFound();
  const r = await getResult(id);
  if (!r) notFound();
  if (r.page?.stop) redirect("/safety");

  const ui = uiCopy();
  const test: TestName = testName(r.slug);
  const order: string[] = ui.layout?.order_by_test?.[test] ?? [];
  const total = order.length;
  const key = keyAt(order, n);
  if (!key) notFound();
  const def: any = (ui.pages as any[]).find((p) => p.key === key) ?? {};
  const nick = r.nickname;
  const freePages: number = ui.layout?.free_pages ?? 3;
  const unlocked = n <= freePages || r.paid === true;

  const title = fill(def.title_by_test?.[test] ?? def.title ?? "", {
    nickname: nick,
    area: unlocked ? String(r.page?.values?.area ?? "") : "",
  });
  const files = (feedManifest()[FEED_GROUP[r.slug]] ?? []).map((f) => f.file);
  const feed = pickFeed(order, files, id, ui.feed?.skip_pages ?? []);
  const isLast = n === total;

  let body: React.ReactNode;
  if (unlocked) {
    const c: Ctx = { id, n, r, page: r.page, ui, test, nick, opened };
    const trait = fill(ui.pages?.find((p: any) => p.key === "p2")?.trait_title ?? "", { nickname: nick });
    body = {
      p1: <P1 c={c} />,
      p2: <P2 c={c} traitTitle={trait} />,
      p3: <P3 c={c} />,
      p3b: <P3b c={c} />,
      p3c: <P3c c={c} />,
      p7: <P7 c={c} />,
      p4: <SalPage c={c} rank={0} />,
      sal2: <SalPage c={c} rank={1} />,
      sal3: <SalPage c={c} rank={2} />,
      p5: <P5 c={c} />,
      p8: <P8 c={c} />,
      p8b: <P8b c={c} />,
      p9: <P9 c={c} />,
      p10: <P10 c={c} />,
    }[key];
  } else {
    // ---- 결제 전 유료 쪽: 여기서부터는 공개 문구만 ----
    const pw = ui.paywall ?? {};
    const price = priceNow().priceText;
    const decision = isDecisionAnswer(r.page?.route?.answer);
    const reviewsSrc: string[] = (ui.reviews?.saju ?? []).length >= 5 ? ui.reviews.saju : (ui.reviews?.fallback_from_tarot ?? []);
    const reviews = seededShuffle(reviewsSrc, hashString(`${id}:${n}`));
    // 대표 살 쪽(p4)도 다른 유료 쪽과 같은 모양(예고 + 흐림 + 결제 상자) — 카드 뒷면·뒤집기는 쓰지 않는다(대표님 2026-11-27).
    // p4에는 흐림 예시가 따로 없어 같은 살 카드 형식인 sal2 예시를 빌려 쓴다(가상 예시).
    const rawSample = ui.blur?.samples?.[key] ?? (key === "p4" ? ui.blur?.samples?.sal2 : undefined);
    const sample: string =
      typeof rawSample === "string" ? rawSample : typeof rawSample?.[test] === "string" ? rawSample[test] : key === "p10" ? (ui.cta_chat?.body ?? "") : "";
    const teaser: string = def.teaser_by_test?.[test] ?? def.teaser ?? "";
    const firstPaid = n === freePages + 1;
    const p3def: any = (ui.pages as any[]).find((p) => p.key === "p3") ?? {};
    // 첫 유료 쪽의 '힘이 커지는 달 n번' 상자(ui_copy.pages[p3b].before_parts, stop.n_rule). 달 이름은 들어 있지 않다.
    const nLine: string = firstPaid && typeof r.page?.retro?.teaser === "string" ? r.page.retro.teaser : "";
    body = (
      <>
        <BlurTeaser teaser={teaser} sample={sample} />
        {nLine && (
          <div className="box">
            <b>{nLine}</b> {p3def.teaser_note ?? ""}
          </div>
        )}
        {firstPaid && (
          <p>
            <Md text={String(decision ? pw.body_decision : pw.body).replace(/\n/g, " ")} />
          </p>
        )}
        <PayBox
          title={fill(decision ? pw.title_decision : pw.title, { nickname: nick })}
          lead={fill(pw.price_lead ?? "", { price })}
          reviews={reviews}
          button={fill(pw.button ?? "", { price })}
          href={`/checkout/${id}?page=${n}`}
        />
      </>
    );
  }

  return (
    <>
      <PageHead n={n} total={total} access={def.access ?? (n <= freePages ? "무료" : "유료")} />
      <main className="pg">
        <h2>
          <Md text={title} />
        </h2>
        <FeedImage file={feed[key]} />
        {body}
        {unlocked && n > freePages && <ShareBar id={id} n={n} share={ui.share?.button ?? ""} save={ui.save?.button ?? ""} />}
        <PageNav id={id} n={n} total={total} />
        <Foot text={ui.disclaimer ?? ""} />
        {isLast && r.safetyLevel === "watch" && ui.safety?.watch_note && <p className="foot">{ui.safety.watch_note}</p>}
      </main>
    </>
  );
}
