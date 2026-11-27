"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readDraft, addHistory } from "./draft";
import { fill } from "@/lib/text";
import type { TestSlug } from "@/lib/tests";

type Copy = { guide: string; messages: string[]; minSeconds: number };

// /{type}/calc — 네 기둥이 채워지는 연출(최소 6초, 3초마다 문장이 바뀜). 그동안 서버에서 결과를 만든다.
// 끝나면 계산 끝 화면(/{type}/calc/done?result=…)으로. 위기면 /safety.
export default function CalcScreen({ slug, copy }: { slug: TestSlug; copy: Copy }) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [i, setI] = useState(0);
  const [err, setErr] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const d = readDraft();
    if (!d.nickname || !d.birth) {
      router.replace(`/${slug}/birth`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNick(d.nickname);
    const minWait = new Promise((r) => setTimeout(r, copy.minSeconds * 1000));
    const call = fetch("/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, nickname: d.nickname, birth: d.birth, ageOk: d.ageOk, worry: d.worry ?? "", answers: d.answers ?? [] }),
    }).then((r) => r.json());
    Promise.all([call, minWait])
      .then(([j]) => {
        if (j.next === "safety") return router.replace("/safety");
        if (j.next === "result" && j.id) {
          addHistory({ id: j.id, slug, at: new Date().toISOString() });
          return router.replace(`/${slug}/calc/done?result=${j.id}`);
        }
        setErr(j.error || "사주를 계산하지 못했어요.");
      })
      .catch(() => setErr("잠시 연결이 끊겼어요. 새로고침해 주세요."));
  }, [router, slug, copy.minSeconds]);

  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % copy.messages.length), 3000);
    return () => window.clearInterval(t);
  }, [copy.messages.length]);

  return (
    <div className="pg center" style={{ paddingTop: 48 }}>
      <p className="pre" style={{ fontFamily: "var(--font-gowun)", fontSize: 17, color: "var(--navy)" }}>
        {fill(copy.guide, { nickname: nick })}
      </p>
      <div className="dots" aria-hidden>
        <i className="bg-목" />
        <i className="bg-화" />
        <i className="bg-토" />
        <i className="bg-금" />
        <i className="bg-수" />
      </div>
      <p key={i} className="fade sub">
        {fill(copy.messages[i] ?? "", { nickname: nick })}
      </p>
      {err && (
        <>
          <p className="err">{err}</p>
          <a className="btn ghost" href={`/${slug}/birth`} style={{ textAlign: "center", textDecoration: "none" }}>
            ←
          </a>
        </>
      )}
    </div>
  );
}
