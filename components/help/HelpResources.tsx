import { HELP_RESOURCES } from "@/lib/safety/safetyReplyData";

// 도움받을 곳 목록(2026-11-18 CSO 결정 — 마이페이지에 늘 게재, 안내 화면 /help에도 같은 목록).
// 전화번호·마들랜 카카오톡 링크는 대화에 넣지 않고 여기에만 둔다. 내용은 sw_ob_help_resources(CSO 묶음 v2.24)와 같다(lib/safety/safetyReplyData.ts).
export default function HelpResources({ compact = false }: { compact?: boolean }) {
  const list = [...HELP_RESOURCES].sort((a, b) => a.sort - b.sort);
  const groups = [...new Set(list.map((r) => r.grp))];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <p className={`mb-1.5 font-medium text-foreground ${compact ? "text-[13px]" : "text-[14px]"}`}>{g}</p>
          <ul className="space-y-1.5">
            {list.filter((r) => r.grp === g).map((r) => (
              <li key={r.res_id} className="rounded-xl border border-line bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] text-foreground">{r.name}</span>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-[#FEE500] px-3 py-1 text-[13px] font-medium text-[#191919]">
                      카카오톡으로 열기
                    </a>
                  ) : (
                    <a href={`tel:${r.contact.replace(/[^0-9]/g, "")}`} className="shrink-0 rounded-full bg-navy px-3 py-1 text-[13px] font-medium text-white">
                      ☎ {r.contact}
                    </a>
                  )}
                </div>
                {(r.note || r.hours) && (
                  <p className="mt-1 text-[12px] leading-5 text-slate-500">
                    {[r.hours, r.note].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
