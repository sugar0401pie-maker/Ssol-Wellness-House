import "server-only";
import Link from "next/link";
import { Md } from "./Md";
import { Weave, Pillars, ElementBars, Calendar, SalCard, type Card } from "./parts";
import { MOCK, frontText, challengeCopy, type UiCopy } from "./copy";
import { fill } from "@/lib/text";
import { sowellaChallengeUrl } from "@/lib/challenge";
import { BANNER_FILE, TEST_SLUGS, testName, type TestName } from "@/lib/tests";
import type { SajuPage, StoredResult } from "@/lib/types";
import { boldFirstSentence, boldSentenceAt, dots, endDot, fillJosa, monthsText, pickBySeed, salKo } from "@/lib/resultView";

// 결제가 확인된 결과(또는 무료 1~3쪽)의 쪽 본문. 결제 전 유료 쪽은 Locked.tsx만 그리며, 이 파일의 컴포넌트는 부르지 않는다.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Ctx = {
  id: string;
  n: number;
  r: StoredResult;
  page: SajuPage;
  ui: UiCopy;
  test: TestName;
  nick: string;
  opened: boolean;
};

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const W = (c: Ctx, k: string) => arr<string>(c.page.weave?.[k]);
const sowellaBase = () => (process.env.NEXT_PUBLIC_SOWELLA_URL || "https://app.ssolwellnesshouse.com").replace(/\/+$/, "");

/** "라벨: 내용" 한 줄 → <b>라벨:</b> 내용 */
function LabelLine({ text }: { text: string }) {
  const i = text.indexOf(":");
  if (i < 0) return <Md text={text} />;
  return (
    <>
      <b>{text.slice(0, i + 1)}</b>
      {text.slice(i + 1)}
    </>
  );
}

/* ---------------- 1쪽: 사주 결과(무료) ---------------- */
export function P1({ c }: { c: Ctx }) {
  const f = frontText().page1;
  const el = c.page.elements ?? {};
  const lines = arr<string>(el.lines);
  return (
    <>
      <Weave label={MOCK.worryLabel} lines={W(c, "p1")} />
      <p>{f.lead}</p>
      <h3>{f.pillars_h}</h3>
      <p className="hint">ⓘ {f.hints.pillars}</p>
      <Pillars pillars={c.page.pillars} labels={MOCK.pillarLabels} />
      <h3>{f.elements_h}</h3>
      <p className="hint">ⓘ {f.hints.elements}</p>
      <ElementBars items={arr(el.items)} />
      {lines.length > 0 && (
        <p>
          <Md text={`**${lines[0]}** ${lines.slice(1).join(" ")}`.trim()} />
        </p>
      )}
      <h3>{f.badges_h}</h3>
      <p className="hint">ⓘ {f.hints.badges}</p>
      <div className="badges">
        {arr<string>(c.page.badges).map((b) => (
          <span key={b} className={`badge${/강함/.test(b) ? " strong" : ""}`}>
            {b}
          </span>
        ))}
      </div>
      <p className="sub">{f.badges_note}</p>
      <p className="sub">
        <Link href={`/about-sal?next=${encodeURIComponent(`/result/${c.id}/1`)}`} style={{ textDecoration: "underline", color: "inherit" }}>
          {str(c.ui.pages?.[0]?.sal_intro_link) || MOCK.salIntroLink}
        </Link>
      </p>
    </>
  );
}

/* ---------------- 2쪽: 당신은 이런 사람일 거예요(무료) ---------------- */
export function P2({ c, traitTitle }: { c: Ctx; traitTitle: string }) {
  const f = frontText().page2;
  const dp = c.page.dayPillar ?? {};
  const ch = c.page.character ?? {};
  const story = str(ch.story).match(/[^.!?]+[.!?]+/g) ?? [];
  const stemHz = dp.hz ? [...str(dp.hz)][0] : "";
  const elOf: Record<string, string> = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" };
  return (
    <>
      <h3>{f.pillar_h}</h3>
      {dp.lead && (
        <p>
          <b>{dp.lead}</b>
        </p>
      )}
      {ch.char && (
        <div className="hero">
          <div className="avatar">
            <span className={`ch c-${elOf[stemHz] ?? "토"}`} style={{ fontSize: 26 }}>
              {stemHz}
            </span>
          </div>
          <p>
            <b>
              {dp.stemName} · {ch.char}
            </b>
            {story[1] && (
              <>
                <br />
                {story[1].trim()}
              </>
            )}
          </p>
        </div>
      )}
      {arr<string>(dp.lines).map((l, i) => (
        <p key={i}>
          <Md text={l} />
        </p>
      ))}
      {dp.note && <p className="sub">{dp.note}</p>}
      {arr<any>(c.page.traits).length > 0 && <h3>{traitTitle}</h3>}
      {arr<any>(c.page.traits).map((t, i) => (
        <p key={i}>
          <Md text={boldFirstSentence(str(t.text))} />
        </p>
      ))}
    </>
  );
}

/* ---------------- 3쪽: 살로 돌아보는 2026년(무료) ---------------- */
export function P3({ c }: { c: Ctx }) {
  const merged = arr<{ kind: string; text: string }>(c.page.retro?.merged);
  const of = (k: string) => merged.filter((m) => m.kind === k).map((m) => m.text);
  const lead = of("lead");
  const worry = of("worry");
  const ack = of("ack");
  const saju = of("saju");
  const tail = of("tail");
  return (
    <>
      {lead.map((t, i) => (
        <p key={`l${i}`}>
          <Md text={boldFirstSentence(t)} />
        </p>
      ))}
      {worry.length > 0 && (
        <p>
          <Md text={worry.join(" ")} />
        </p>
      )}
      {ack.map((t, i) => (
        <p key={`a${i}`}>
          <b>{t}</b>
        </p>
      ))}
      {saju.length > 0 && (
        <p>
          <Md text={saju.join(" ")} />
        </p>
      )}
      {tail.map((t, i) => (
        <p className="sub" key={`t${i}`}>
          {t}
        </p>
      ))}
      <Weave label={MOCK.worryLabel} lines={W(c, "p3")} />
      {W(c, "p3look").map((t, i) => (
        <p key={`k${i}`}>
          <Md text={t} />
        </p>
      ))}
    </>
  );
}

/* ---------------- 4쪽: 성향(p3b) ---------------- */
export function P3b({ c }: { c: Ctx }) {
  const v = c.page.values ?? {};
  return (
    <>
      {arr<string>(v.summary).length > 0 && (
        <div className="sumbox">
          <em>{MOCK.summaryLabel}</em>
          <ul>
            {arr<string>(v.summary).map((s, i) => (
              <li key={i}>
                <Md text={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul>
        {arr<{ label: string; text: string }>(v.lines).map((l, i) => (
          <li key={i}>
            <b>{l.text}</b> ({l.label})
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- 5쪽: 살로 본 ○○ 가치관(p3c) ---------------- */
export function P3c({ c }: { c: Ctx }) {
  const v = c.page.values ?? {};
  return (
    <>
      {arr<string>(v.salSummary).length > 0 && (
        <div className="sumbox">
          <em>{MOCK.summaryLabel}</em>
          <ul>
            {arr<string>(v.salSummary).map((s, i) => (
              <li key={i}>
                <Md text={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul>
        {arr<{ salName: string; easy: string; text: string }>(v.salLines).map((l, i) => (
          <li key={i}>
            <b>{l.text}</b> ({l.salName} · {l.easy})
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- 6쪽: 강점을 살리는 방식(p7) — 테스트마다 다름 ---------------- */
export function P7({ c }: { c: Ctx }) {
  const p4 = c.page.p4 ?? {};
  let body: React.ReactNode = null;
  if (c.test === "직장운") {
    const m = MOCK.career;
    body = (
      <>
        <h3>{m.h1}</h3>
        <table>
          <tbody>
            <tr>
              <th>{m.th[0]}</th>
              <th>{m.th[1]}</th>
            </tr>
            {arr<any>(p4.dims).map((d) => (
              <tr key={d.k}>
                <td>{d.name}</td>
                <td>{dots(d.dots)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p4.summary && (
          <div className="box">
            <b>{p4.summary}</b>
            {m.best}
            {arr<string>(p4.summaryExamples).map((x, i) => (
              <span key={i}>
                <br />
                {x}
              </span>
            ))}
          </div>
        )}
        {p4.caution && (
          <>
            <h3>② {p4.cautionTitle}</h3>
            <p>
              <Md text={boldFirstSentence(p4.caution)} />
            </p>
          </>
        )}
        {p4.tire && (
          <>
            <h3>{m.h3}</h3>
            <p>
              <b>{endDot(p4.tire)}</b>
            </p>
          </>
        )}
        {arr<any>(p4.tiers).map((t, i) => (
          <div key={i}>
            <h3>{t.label}</h3>
            <p>
              <b>{t.why}</b>
            </p>
            <ul>
              {arr<string>(t.fields).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </>
    );
  } else if (c.test === "연애운") {
    const m = MOCK.love;
    body = (
      <>
        <h3>{m.h1}</h3>
        <ul>
          {arr<any>(p4.modes).map((x) => (
            <li key={x.k}>
              <b>{x.k}:</b> {x.text}
            </li>
          ))}
        </ul>
        {p4.avoid && (
          <>
            <h3>{m.h2}</h3>
            <p>
              <b>{endDot(p4.avoid)}</b>
            </p>
          </>
        )}
        {arr<any>(p4.need).length > 0 && (
          <>
            <h3>{m.h3}</h3>
            <table>
              <tbody>
                <tr>
                  <th>{m.th[0]}</th>
                  <th>{m.th[1]}</th>
                </tr>
                {arr<any>(p4.need).map((x, i) => (
                  <tr key={i}>
                    <td>{x.mine}</td>
                    <td>{x.partner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {arr<any>(p4.place).length > 0 && (
          <>
            <h3>{m.h4}</h3>
            <ul>
              {arr<any>(p4.place).map((x, i) => (
                <li key={i}>
                  <b>{x.text}</b>
                  {x.why ? ` — ${x.why}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  } else if (c.test === "재물운") {
    const m = MOCK.money;
    body = (
      <>
        <h3>{m.h1}</h3>
        <table>
          <tbody>
            <tr>
              {m.th.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
            {arr<any>(p4.types).map((t) => (
              <tr key={t.k}>
                <td>{t.name}</td>
                <td>{dots(t.dots)}</td>
                <td>{t.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p4.structure && (
          <div className="box">
            <b>{p4.structure}</b>
          </div>
        )}
        <h3>{m.h2}</h3>
        <ul>
          {arr<any>(p4.leaks).map((x, i) => (
            <li key={i}>
              <b>{x.text}</b>
              {x.why ? ` — ${x.why}` : ""}
            </li>
          ))}
        </ul>
        {arr<any>(p4.side).length > 0 && (
          <>
            <h3>{m.h3}</h3>
            <ul>
              {arr<any>(p4.side).map((x, i) => (
                <li key={i}>
                  <b>{x.sal}:</b> {x.line}
                </li>
              ))}
            </ul>
          </>
        )}
        {p4.save && (
          <>
            <h3>{m.h4}</h3>
            <p>
              <b>{p4.save}</b>
            </p>
          </>
        )}
        {p4.smallPrint && (
          <p className="sub">
            {MOCK.financeMark}
            {p4.smallPrint}
          </p>
        )}
      </>
    );
  } else {
    const m = MOCK.total;
    const love = p4.연애 ?? {};
    const job = p4.직장 ?? {};
    const money = p4.재물 ?? {};
    const rel = p4.관계 ?? {};
    body = (
      <>
        <h3>{m.areas.연애}</h3>
        <ul>
          {love.line && (
            <li>
              <Md text={boldFirstSentence(love.line)} />
            </li>
          )}
          {love.partner && (
            <li>
              <b>{m.partner}</b> {love.partner}
            </li>
          )}
          {love.place && (
            <li>
              <b>{m.place}</b> {love.place}
            </li>
          )}
        </ul>
        <h3>{m.areas.직장}</h3>
        <ul>
          {job.line && (
            <li>
              <b>{job.line}</b>
            </li>
          )}
          {job.tire && (
            <li>
              {m.care} {endDot(job.tire)}
            </li>
          )}
          {job.field && (
            <li>
              <b>{m.field}</b> {job.field}
            </li>
          )}
        </ul>
        <h3>{m.areas.재물}</h3>
        <ul>
          {money.line && (
            <li>
              <b>{money.line}</b>
            </li>
          )}
          {money.leak && (
            <li>
              {m.care} {money.leak}
            </li>
          )}
          {money.save && (
            <li>
              <b>{m.save}</b> {money.save}
            </li>
          )}
        </ul>
        <h3>{m.areas.관계}</h3>
        <ul>
          {rel.line && (
            <li>
              <b>{rel.line}</b>
            </li>
          )}
          {rel.help && (
            <li>
              <b>{m.partner}</b> {rel.help}
            </li>
          )}
          {rel.care && (
            <li>
              {m.care} {endDot(rel.care)}
            </li>
          )}
        </ul>
        {money.smallPrint && (
          <p className="sub">
            {MOCK.financeMark}
            {money.smallPrint}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      {body}
      <Weave label={MOCK.worryLabel} lines={[...W(c, "p7"), ...W(c, "p7b")]} />
    </>
  );
}

/* ---------------- 대표 살 쪽(p4 · sal2 · sal3) ---------------- */
function cardLabels(c: Ctx): string[] {
  return arr<string>(c.ui.sal_card?.show).map((s) => s.replace(/\(.*\)$/, "").replace("{테스트}", c.test));
}

export function SalPage({ c, rank }: { c: Ctx; rank: 0 | 1 | 2 }) {
  const cards = arr<Card>(c.page.cards);
  const card = cards[rank];
  const marks = ["①", "②", "③"];
  const p6 = arr<string[]>(c.page.weave?.p6)[rank] ?? [];
  const p6title = arr<string>(c.page.weave?.p6title)[rank];
  const kp = c.ui.key_page ?? {};
  const keyPage = rank === 0;
  const easyOf = (name: string) => str(c.page.sals?.[name]?.easy);
  return (
    <>
      {keyPage && c.opened && card && (
        <div className="bigsal flip">
          <span>{card.name}</span>
          <small>{easyOf(card.name)}</small>
        </div>
      )}
      {keyPage && (
        <>
          <h3>{str(c.ui.pages?.find((p: any) => p.key === "p4")?.rep_title)}</h3>
          <div className="reprow">
            {cards.slice(0, 3).map((x, i) => (
              <div className="sal" key={x.name}>
                <em>{i + 1}위</em>
                <b>{x.name}</b>
                <small>{easyOf(x.name)}</small>
              </div>
            ))}
          </div>
          {card && kp.opened_line && (
            <p>
              <Md text={fillJosa(fill(kp.opened_line, { nickname: c.nick }), { sal: card.name })} />
            </p>
          )}
        </>
      )}
      {card && <SalCard card={card} mark={marks[rank]} labels={cardLabels(c)} />}
      {p6.length > 0 && <Weave label={`${MOCK.worryLabel}${p6title ? ` · ${p6title}` : ""}`} lines={p6} />}
    </>
  );
}

/* ---------------- 10쪽: 2027년 한 해와 열두 달(p5) ---------------- */
export function P5({ c }: { c: Ctx }) {
  const cell = c.ui.calendar_cell ?? {};
  const labels: Record<number, string> = {};
  for (const m of arr<any>(c.page.months)) labels[m.month] = m.label;
  const marks: Record<number, string> = {};
  const raw = c.page.weave?.marks;
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) if (typeof v === "string") marks[Number(k)] = v;
  const reps = arr<Card>(c.page.cards).map((x) => x.name);
  const daeun = str(c.page.year?.daeun?.line);
  return (
    <>
      {daeun && (
        <p>
          <Md text={boldSentenceAt(daeun, 1)} />
        </p>
      )}
      <Calendar
        calendar={arr(c.page.calendar)}
        labels={labels}
        reps={reps}
        marks={marks}
        shakenLabel={str(cell.shaken_label) || "부딪힘"}
        join={str(cell.join) || ", "}
      />
      <Weave label={MOCK.worryLabel} lines={W(c, "p5")} />
    </>
  );
}

/* ---------------- 11쪽: 언제 움직일까(p8) ---------------- */
export function P8({ c }: { c: Ctx }) {
  const h = c.page.halves ?? {};
  const p5 = c.page.p5 ?? {};
  const monthsOf = (list: unknown) => monthsText(arr<any>(list).map((x) => (typeof x === "number" ? x : x.month)));
  let extra: React.ReactNode = null;
  if (c.test === "직장운") {
    extra = (
      <>
        {arr<number>(p5.avoid).length > 0 && (
          <>
            <h3>{MOCK.careerAvoidH}</h3>
            <p>
              <b>{monthsText(arr<number>(p5.avoid))}</b> — {arr<string>(p5.avoidWhy).join(" ")}
            </p>
          </>
        )}
        {arr<any>(p5.recognitionLines).length > 0 && (
          <>
            <h3>{MOCK.careerRecogH}</h3>
            <ul>
              {arr<any>(p5.recognitionLines).map((x, i) => (
                <li key={i}>
                  <b>{monthsText(arr<number>(x.months))}:</b> {x.why} {x.gain}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  } else if (c.test === "연애운" || c.test === "재물운") {
    const rows = (c.test === "연애운" ? MOCK.loveRows : MOCK.moneyRows).filter(([k]) => arr(p5[k]).length > 0);
    extra = (
      <>
        {rows.length > 0 && <h3>{MOCK.monthlyH}</h3>}
        <ul>
          {rows.map(([k, label]) => (
            <li key={k}>
              <b>{label}:</b> {monthsOf(p5[k])}
            </li>
          ))}
        </ul>
        {c.test === "연애운" && p5.theirMind && <div className="box">{p5.theirMind}</div>}
      </>
    );
  }
  return (
    <>
      <h3>{MOCK.halvesH}</h3>
      {h.head && (
        <p>
          <b>{h.head}</b> {[h.why, h.tip].filter(Boolean).join(" ")}
        </p>
      )}
      <ul>
        {arr<string>(h.rows).map((r, i) => (
          <li key={i}>
            <LabelLine text={r} />
          </li>
        ))}
      </ul>
      {extra}
      <div className="box">{fill(MOCK.choiceNote, { nickname: c.nick })}</div>
      <Weave label={MOCK.worryLabel} lines={W(c, "p8")} />
    </>
  );
}

/* ---------------- 12쪽: 움직이는 날짜와 이유(p8b) ---------------- */
export function P8b({ c }: { c: Ctx }) {
  const p5 = c.page.p5 ?? {};
  const whenOf = (m: number, given?: string) => given || str(arr<any>(c.page.months).find((x) => x.month === m)?.when) || `${m}월`;
  const MonthList = ({ list }: { list: any[] }) => (
    <ul>
      {list.map((x, i) => (
        <li key={i}>
          <b>{whenOf(x.month, x.when)}:</b> {x.why}
        </li>
      ))}
    </ul>
  );
  if (c.test === "직장운") {
    const steps = arr<any>(p5.steps);
    const seen = new Set<string>();
    const fresh = (lines: string[]) => lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
    return (
      <>
        {steps.length > 0 && (
          <p>
            <b>{steps.map((s) => `${s.step} ${s.monthsText}`).join(" → ")}</b>
          </p>
        )}
        {steps.map((s, i) => (
          <div key={i}>
            <h3>
              {s.step} — {s.when}
            </h3>
            <ul>
              {fresh(arr<string>(s.why)).map((l, j) => (
                <li key={j}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
        {p5.early && (
          <>
            <h3>
              {MOCK.careerEarlyH} — {p5.early.when}
            </h3>
            <ul>
              {arr<string>(p5.early.why)
                .filter((l) => !l.includes(MOCK.careerEarlyH))
                .map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
            </ul>
          </>
        )}
      </>
    );
  }
  if (c.test === "연애운" || c.test === "재물운") {
    const rows = (c.test === "연애운" ? MOCK.loveRows : MOCK.moneyRows).filter(([k]) => arr(p5[k]).length > 0);
    return (
      <>
        {rows.map(([k, label]) => (
          <div key={k}>
            <h3>{label}</h3>
            <MonthList list={arr(p5[k]).slice(0, 3)} />
          </div>
        ))}
      </>
    );
  }
  const areas = Object.keys(MOCK.total.areas).filter((a) => arr(p5[a]).length > 0);
  return (
    <>
      <h3>{MOCK.totalAreasH}</h3>
      <ul>
        {areas.map((a) => (
          <li key={a}>
            <b>{MOCK.total.areas[a]}:</b> {monthsText(arr<number>(p5[a]))}
          </li>
        ))}
      </ul>
      {areas.map((a) => (
        <div key={a}>
          <h3>{MOCK.total.areas[a]}</h3>
          <MonthList list={arr<number>(p5[a]).slice(0, 3).map((m) => ({ month: m, why: str(p5.why?.[a]?.[m]) }))} />
        </div>
      ))}
    </>
  );
}

/* ---------------- 13쪽: 내 살을 강점으로 만드는 활용법(p9) — 작심삼일 챌린지 ---------------- */
export function P9({ c }: { c: Ctx }) {
  const cc = challengeCopy();
  const ch = c.page.challenge ?? {};
  const days = arr<any>(ch.days);
  const g = c.ui.glossary ?? {};
  const moneyTypes = arr<string>(ch.moneyTypes);
  const lead =
    c.test === "재물운" && moneyTypes.length > 0 && cc.lead_money
      ? fill(cc.lead_money, { nickname: c.nick, types: moneyTypes.join(", ") })
      : fill(str(cc.lead_saju), { nickname: c.nick, sals: arr<Card>(c.page.cards).slice(0, 3).map((x) => salKo(x.name)).join(", ") });
  return (
    <>
      {days.length > 0 && (
        <div className="cres">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="banimg" alt={MOCK.challengeAlt} src={MOCK.challengeImg} />
          {lead && <p className="csub">{lead}</p>}
          {days.map((d, i) => (
            <div className="cday" key={i}>
              <div className="cbadge">{fill(MOCK.dayBadge, { n: d.day ?? i + 1 })}</div>
              <div className="ctxt">
                <i>{[d.kind, ...(i > 0 ? arr<string>(d.sals) : [])].filter(Boolean).join(" · ")}</i>
                <b>{d.text}</b>
                {i === 0 && d.detail && <span className="cdet">{d.detail}</span>}
                {i > 0 && d.why && <em>{d.why}</em>}
              </div>
            </div>
          ))}
          {(ch.week || ch.month) && (
            <div className="clater">
              <h4>{cc.later_title}</h4>
              {ch.week?.text && (
                <div>
                  <em>{cc.week_label}</em>
                  {ch.week.text}
                </div>
              )}
              {ch.month?.text && (
                <div>
                  <em>{cc.month_label}</em>
                  {[ch.month.when, ch.month.text].filter(Boolean).join(" ")}
                </div>
              )}
            </div>
          )}
          {cc.share && <p className="cshare">{cc.share}</p>}
          <a className="ccta" href={sowellaChallengeUrl(c.id)}>
            {cc.cta}
          </a>
          {cc.cta_note && <p className="cnote">{cc.cta_note}</p>}
        </div>
      )}
      {arr<string>(g.lines).length > 0 && (
        <details className="gloss" open={g.collapsed === false}>
          <summary>
            {g.title} <small>{MOCK.glossOpen}</small>
          </summary>
          <ul>
            {arr<string>(g.lines).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/* ---------------- 14쪽: 쏘웰라와 이어서 이야기하기(p10) ---------------- */
export function P10({ c }: { c: Ctx }) {
  const cta = c.ui.cta_chat ?? {};
  const chat = cta.chat ?? {};
  const cc = challengeCopy();
  const xs = c.ui.cross_sell ?? {};
  const day2 = str(arr<any>(c.page.challenge?.days)[1]?.text);
  const me = pickBySeed(arr<string>(chat.user_random), c.id);
  const others = TEST_SLUGS.filter((s) => testName(s) !== c.test);
  return (
    <>
      <Weave label={MOCK.worryLabel} lines={W(c, "p10")} />
      {cta.body && (
        <p>
          <Md text={boldFirstSentence(cta.body)} />
        </p>
      )}
      {chat.sowella && day2 && (
        <div className="chat">
          <div className="cb sw">
            <i>{MOCK.sowellaName}</i>
            {fill(chat.sowella, { nickname: c.nick, challenge: day2 })}
          </div>
          {me && <div className="cb me">{me}</div>}
        </div>
      )}
      <a className="btn" href={sowellaBase()}>
        {cta.button}
      </a>
      {xs.title && <h3>{xs.title}</h3>}
      {others.map((s) => (
        <Link key={s} href={`/${s}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="banimg" src={BANNER_FILE[s]} alt={str(xs.lines?.[testName(s)])} />
        </Link>
      ))}
      {cc.lantern && (
        <div className="lantern">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="banimg" alt={MOCK.lanternAlt} src={MOCK.lanternImg} />
          <b>{cc.lantern}</b>
          <a className="ccta" href={sowellaBase()}>
            {cc.lantern_btn}
          </a>
        </div>
      )}
    </>
  );
}
