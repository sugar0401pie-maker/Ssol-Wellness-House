import { uiCopy } from "@/lib/engine";

// /safety — 위기 안내. 죽음·자해 직접 표현이면 결과·결제로 넘어가지 않고 여기만 보여 준다(설계 문서 7-7).
// 문구는 타로 안전 문구를 옮긴 것 — 상담사 승인 전(ui_copy.safety.to_check). 이 화면에는 결제·광고·다른 테스트 안내를 두지 않는다.
export const metadata = { robots: { index: false } };

export default function Safety() {
  const s = uiCopy().safety;
  return (
    <div className="pg" style={{ paddingTop: 32 }}>
      <h2>{s.urgent_title}</h2>
      <p>{s.urgent_body}</p>
      {(s.urgent_contacts as { name: string; number: string; note: string }[]).map((c) => (
        <div key={c.name} className="box">
          <b>{c.name}</b> {c.number && <a href={`tel:${c.number}`}>{c.number}</a>}
          {c.note && <div className="sub">{c.note}</div>}
        </div>
      ))}
    </div>
  );
}
