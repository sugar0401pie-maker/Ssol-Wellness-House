"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readDraft, saveDraft } from "./draft";
import { fill } from "@/lib/text";
import type { BirthInput } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Copy = Record<string, any>;

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 14 - 1900 + 1 }, (_, i) => thisYear - 14 - i);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// /{type}/birth — 만 14세 체크 한 줄(팝업 없음) · 양력/음력/윤달 · 시간(모르면 시간대) · 시·도 · 성별
export default function BirthForm({ slug, copy, regions }: { slug: string; copy: Copy; regions: string[] }) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [b, setB] = useState<BirthInput>({
    calendar: "양력",
    year: 1995,
    month: 1,
    day: 1,
    timeKnown: true,
    hour: 12,
    minute: 0,
    timeSlot: null,
    region: null,
    gender: "선택 안 함",
  });
  const [ageOk, setAgeOk] = useState(false);

  useEffect(() => {
    const d = readDraft();
    if (!d.nickname) {
      router.replace(`/${slug}/welcome`);
      return;
    }
    // 브라우저 저장값을 처음 한 번 화면에 채운다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNick(d.nickname);
    if (d.birth) setB(d.birth);
    if (d.ageOk) setAgeOk(true);
  }, [router, slug]);

  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) => setB((x) => ({ ...x, [k]: v }));
  const slots: string[] = copy.time_slots;
  const ready = ageOk && (b.timeKnown || b.timeSlot);

  function next() {
    if (!ready) return;
    saveDraft({ birth: b, ageOk });
    router.push(`/${slug}/birth/confirm`);
  }

  return (
    <div className="pg">
      <h2>{fill(copy.title, { nickname: nick })}</h2>
      <p className="sub">{copy.sub}</p>

      <div className="field">
        <div className="chips">
          {(copy.calendar as BirthInput["calendar"][]).map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={b.calendar === c} onClick={() => set("calendar", c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="field row3">
        <select className="inp" aria-label="년" value={b.year} onChange={(e) => set("year", Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select className="inp" aria-label="월" value={b.month} onChange={(e) => set("month", Number(e.target.value))}>
          {range(1, 12).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
        <select className="inp" aria-label="일" value={b.day} onChange={(e) => set("day", Number(e.target.value))}>
          {range(1, 31).map((d) => (
            <option key={d} value={d}>
              {d}일
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="lb">{copy.time_label}</span>
        {b.timeKnown && (
          <div className="row2">
            <select className="inp" aria-label="시" value={b.hour} onChange={(e) => set("hour", Number(e.target.value))}>
              {range(0, 23).map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
            <select className="inp" aria-label="분" value={b.minute} onChange={(e) => set("minute", Number(e.target.value))}>
              {range(0, 59).map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={!b.timeKnown}
            onChange={(e) => setB((x) => ({ ...x, timeKnown: !e.target.checked, timeSlot: e.target.checked ? x.timeSlot : null }))}
          />
          {copy.time_unknown}
        </label>
        {!b.timeKnown && (
          <>
            <div className="chips">
              {slots.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={b.timeSlot === s} onClick={() => set("timeSlot", s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="hint">{copy.time_note}</p>
          </>
        )}
      </div>

      <div className="field">
        <span className="lb">{copy.place_label}</span>
        <select className="inp" value={b.region ?? ""} onChange={(e) => set("region", e.target.value || null)}>
          <option value="">-</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="lb">{copy.gender_label}</span>
        <div className="chips">
          {(copy.gender as BirthInput["gender"][]).map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={b.gender === g} onClick={() => set("gender", g)}>
              {g}
            </button>
          ))}
        </div>
        {b.gender === "선택 안 함" && <p className="hint">{copy.gender_note}</p>}
      </div>

      <label className="check">
        <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
        {copy.age_check}
      </label>
      <p className="hint">{copy.privacy}</p>

      <button className="btn" disabled={!ready} onClick={next}>
        {copy.button}
      </button>
    </div>
  );
}
