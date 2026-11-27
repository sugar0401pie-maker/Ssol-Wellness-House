"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readDraft, saveDraft } from "./draft";
import { fill } from "@/lib/text";

type Copy = {
  title: string;
  sub: string;
  hint: string;
  min_len: number;
  max_len: number;
  too_short: string;
  button_submit: string;
  button_skip: string;
  footnote: string;
  rotate_seconds: number;
  short: string;
  examples: string[]; // 테스트별 예시 6개(A안 — 짧은 한 문장 순환)
};

// /{type}/worry — 예시 3초 순환, 10자 미만 보충 안내, 건너뛰기 가능.
// 제출하면 서버가 안전 확인을 먼저 하고(위기 → /safety), 짧은 고민이면 다시 묻기(/{type}/worry/followup)로 보낸다.
export default function WorryForm({ slug, copy }: { slug: string; copy: Copy }) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [text, setText] = useState("");
  const [ex, setEx] = useState(0);
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = readDraft();
    if (!d.nickname || !d.birth) {
      router.replace(`/${slug}/birth`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNick(d.nickname);
    if (d.worry) setText(d.worry);
  }, [router, slug]);

  useEffect(() => {
    if (!copy.examples.length) return;
    const t = window.setInterval(() => setEx((i) => (i + 1) % copy.examples.length), copy.rotate_seconds * 1000);
    return () => window.clearInterval(t);
  }, [copy.examples.length, copy.rotate_seconds]);

  async function go(worry: string) {
    setBusy(true);
    setErr("");
    saveDraft({ worry, answers: [], followup: null });
    try {
      const res = await fetch("/api/worry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, text: worry, nickname: nick }),
      });
      const j = await res.json();
      if (j.next === "safety") return router.push("/safety");
      if (j.next === "followup") {
        saveDraft({ followup: { intro: j.intro, question: j.question } });
        return router.push(`/${slug}/worry/followup`);
      }
      router.push(`/${slug}/calc`);
    } catch {
      setErr("잠시 연결이 끊겼어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    if ([...t].length < copy.min_len && !warn) {
      setWarn(true); // 한 번 안내하고, 그래도 누르면 그대로 넘어간다
      return;
    }
    go(t);
  }

  return (
    <div className="pg">
      <h2 className="pre">{fill(copy.title, { nickname: nick, short: copy.short })}</h2>
      <p className="sub">{copy.sub}</p>
      <div className="field">
        <textarea
          className="inp"
          value={text}
          maxLength={copy.max_len}
          placeholder={copy.examples[ex] ?? ""}
          onChange={(e) => {
            setText(e.target.value);
            setWarn(false);
          }}
        />
        <p className="sub" style={{ textAlign: "right", margin: "4px 0 0" }}>
          {[...text].length}/{copy.max_len}
        </p>
        <p className="hint">{copy.hint}</p>
        {warn && <p className="err">{copy.too_short}</p>}
        {err && <p className="err">{err}</p>}
      </div>
      <button className="btn" disabled={busy || !text.trim()} onClick={submit}>
        {copy.button_submit}
      </button>
      <button className="btn ghost" disabled={busy} onClick={() => go("")}>
        {copy.button_skip}
      </button>
      <p className="hint mt">{copy.footnote}</p>
    </div>
  );
}
