"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readDraft, saveDraft } from "./draft";

type Copy = {
  title: string;
  sub: string;
  placeholder: string;
  button: string;
  empty_error: string;
  max_len: number;
  ask: { question: string; options: string[] };
};

// /{type}/welcome — 닉네임 + '사주를 본 적이 있나요?'(고르지 않아도 됨, ui_copy.sal_intro.ask)
export default function WelcomeForm({ slug, copy }: { slug: string; copy: Copy }) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = readDraft();
    // 브라우저 저장값을 처음 한 번 화면에 채운다(서버 렌더에는 없는 값이라 effect에서)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d.nickname) setNick(d.nickname);
    if (d.firstTimer) setFirst(d.firstTimer);
  }, []);

  function next() {
    const n = nick.replace(/\s+/g, " ").trim();
    if (!n) return setErr(copy.empty_error);
    saveDraft({ nickname: [...n].slice(0, copy.max_len).join(""), firstTimer: first });
    router.push(`/${slug}/birth`);
  }

  return (
    <div className="pg">
      <h2 className="pre">{copy.title}</h2>
      <p className="sub">{copy.sub}</p>
      <div className="field">
        <input
          className="inp"
          value={nick}
          maxLength={copy.max_len}
          placeholder={copy.placeholder}
          onChange={(e) => {
            setNick(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) next();
          }}
        />
        {err && <p className="err">{err}</p>}
      </div>
      <div className="field">
        <span className="lb">{copy.ask.question}</span>
        <div className="chips">
          {copy.ask.options.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={first === o} onClick={() => setFirst(first === o ? null : o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <button className="btn mt" onClick={next}>
        {copy.button}
      </button>
    </div>
  );
}
