import Link from "next/link";
import { Md, MdLines } from "./Md";
import { boldFirstSentence, STEM, BRANCH, gradeClass, ganjiHanja } from "@/lib/resultView";

// 결과 쪽에서 함께 쓰는 작은 조각들(서버 컴포넌트).

/** 고민 맞춤 상자(.wv). 첫 줄의 첫 문장은 굵게(ui_copy.style.worry_box.first_line). 줄이 없으면 그리지 않는다. */
export function Weave({ label, lines }: { label: string; lines: readonly string[] | null | undefined }) {
  const ls = (lines ?? []).filter((l) => typeof l === "string" && l.trim());
  if (ls.length === 0) return null;
  return (
    <div className="wv">
      <em>{label}</em>
      <MdLines lines={[boldFirstSentence(ls[0]), ...ls.slice(1)]} />
    </div>
  );
}

/** 쪽 위 띠: "N / 14" + 무료/유료. */
export function PageHead({ n, total, access }: { n: number; total: number; access: string }) {
  return (
    <div className="ph">
      <span>
        {n} / {total}
      </span>
      <span className={`acc ${access === "무료" ? "free" : "paid"}`}>{access}</span>
    </div>
  );
}

/** 이전/다음 — 쪽마다 자기 주소(팝업 없음). */
export function PageNav({ id, n, total }: { id: string; n: number; total: number }) {
  return (
    <nav className="rnav" aria-label="쪽 넘기기">
      {n > 1 ? (
        <Link className="rnav-prev" href={`/result/${id}/${n - 1}`}>
          이전
        </Link>
      ) : (
        <span />
      )}
      <span className="rnav-n">
        {n} / {total}
      </span>
      {n < total ? (
        <Link className="rnav-next" href={`/result/${id}/${n + 1}`}>
          다음
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** 피드 그림(정사각) 1장. */
export function FeedImage({ file }: { file: string | undefined }) {
  if (!file) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="feed" alt="" src={`/feed/${file}`} width={1080} height={1080} />;
}

/** 공유 · 저장(결제 뒤 4쪽부터). 공유는 카카오 노란 버튼(ui_copy.share.button_style). */
export function ShareBar({ id, n, share, save }: { id: string; n: number; share: string; save: string }) {
  return (
    <div className="sharebar">
      <Link className="kakao" href={`/share/${id}`}>
        <span className="klogo" aria-hidden="true" />
        {share}
      </Link>
      <Link href={`/login?next=${encodeURIComponent(`/result/${id}/${n}`)}`}>{save}</Link>
    </div>
  );
}

type Pillar = { stem: string; branch: string } | null | undefined;
/** 네 기둥(연주 · 월주 · 일주 · 시주). 시를 모르면 빈 칸. */
export function Pillars({ pillars, labels }: { pillars: Record<string, Pillar>; labels: string[] }) {
  const keys = ["year", "month", "day", "hour"];
  return (
    <div className="pillars">
      {keys.map((k, i) => {
        const p = pillars?.[k];
        const s = p ? STEM[p.stem] : undefined;
        const b = p ? BRANCH[p.branch] : undefined;
        return (
          <div className={`pil${k === "day" ? " day" : ""}`} key={k}>
            <small>{labels[i]}</small>
            <div className={`ch${s ? ` c-${s[1]}` : ""}`}>
              {s?.[0] ?? "–"}
              <i>{p?.stem ?? ""}</i>
            </div>
            <div className={`ch${b ? ` c-${b[1]}` : ""}`}>
              {b?.[0] ?? "–"}
              <i>{p?.branch ?? ""}</i>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ElItem = { el: string; name: string; count: number; me?: boolean };
/** 오행 막대. */
export function ElementBars({ items }: { items: ElItem[] }) {
  const max = Math.max(1, ...items.map((x) => x.count));
  return (
    <div className="elg">
      {items.map((x) => (
        <div className="elr" key={x.el}>
          <span className={`eln c-${x.el}`}>
            {x.name}({x.el}){x.me && <small>나</small>}
          </span>
          <span className="elb">
            <i className={`bg-${x.el}`} style={{ width: `${Math.round((x.count / max) * 100)}%` }} />
          </span>
          <b>{x.count}</b>
        </div>
      ))}
    </div>
  );
}

type CalMonth = { month: number; pillar: string; grade: string; active?: string[]; shaken?: string[] };
/** 열두 달 달력(ui_copy.calendar_cell). 부딪힘은 대표 살만. */
export function Calendar({
  calendar,
  labels,
  reps,
  marks,
  shakenLabel,
  join,
}: {
  calendar: CalMonth[];
  labels: Record<number, string>;
  reps: string[];
  marks: Record<number, string>;
  shakenLabel: string;
  join: string;
}) {
  return (
    <div className="months">
      {calendar.map((c) => {
        const shaken = (c.shaken ?? []).filter((s) => reps.includes(s));
        return (
          <div className={`mo ${gradeClass(c.grade)}`} key={c.month}>
            <div className="mn">
              {c.month}월{marks[c.month] && <> <span className="mk">{marks[c.month]}</span></>}
            </div>
            <div className="gz">{ganjiHanja(c.pillar)}</div>
            {labels[c.month] && <div className="gr">{labels[c.month]}</div>}
            {(c.active ?? []).length > 0 && <div className="ln">{(c.active ?? []).slice(0, 3).join(join)}</div>}
            {shaken.length > 0 && (
              <div className="sh">
                {shakenLabel}: {shaken.join(join)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 살 카드(어디에 있나요 · 어떤 힘인가요 · 도움이 되나요 · {테스트}에 쓰는 법). cards[].when은 쓰지 않는다(ui_copy.sal_card.hide). */
export type Card = { name: string; title: string; where?: string; power?: string; help?: string; use?: string; howTo?: string; note?: string };
export function SalCard({ card, mark, labels }: { card: Card; mark: string; labels: string[] }) {
  const useText = [card.use, card.howTo]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => (/[.!?]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`))
    .join(" ");
  const rows: [string, string | undefined][] = [
    [labels[0], card.where],
    [labels[1], card.power],
    [labels[2], card.help],
    [labels[3], useText],
  ];
  return (
    <>
      <h3>
        {mark} {card.title}
        {card.note ? "*" : ""}
      </h3>
      <ul>
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <li key={k}>
              <b>{k}:</b> <Md text={v} />
            </li>
          ))}
      </ul>
      {card.note && <p className="sub">{card.note.trim().startsWith("*") ? card.note : `* ${card.note}`}</p>}
    </>
  );
}

/** 꼬리 안내문(모든 결과 쪽 맨 아래). */
export function Foot({ text }: { text: string }) {
  return <p className="foot">{text}</p>;
}
