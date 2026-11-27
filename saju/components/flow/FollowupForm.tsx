"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readDraft, saveDraft, type Draft } from "./draft";

// /{type}/worry/followup — 짧은 고민(20자 이하)일 때 한두 개 더 묻는다(다시 묻기, 설계 문서 7-10).
// 고른 답은 인용에 쓰지 않고 고민 틀에만 쓴다(엔진 composeWorry).
export default function FollowupForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const x = readDraft();
    if (!x.followup?.question) {
      router.replace(`/${slug}/worry`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(x);
  }, [router, slug]);

  if (!d?.followup?.question) return null;
  const q = d.followup.question;

  async function pick(id: string) {
    setBusy(true);
    const answers = [...(d!.answers ?? []), { q: q.key, id }];
    saveDraft({ answers });
    try {
      const res = await fetch("/api/worry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, text: d!.worry ?? "", nickname: d!.nickname, answers }),
      });
      const j = await res.json();
      if (j.next === "safety") return router.push("/safety");
      if (j.next === "followup" && j.question?.key !== q.key) {
        const nd = saveDraft({ followup: { intro: null, question: j.question } });
        setD(nd);
        setBusy(false);
        return;
      }
    } catch {
      /* 다시 묻기는 보조 단계 — 실패하면 계산으로 넘어간다 */
    }
    router.push(`/${slug}/calc`);
  }

  return (
    <div className="pg">
      {d.followup.intro && <p className="sub">{d.followup.intro}</p>}
      <h2>{q.ask}</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {q.options.map((o) => (
          <button key={o.id} className="btn ghost" disabled={busy} onClick={() => pick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
