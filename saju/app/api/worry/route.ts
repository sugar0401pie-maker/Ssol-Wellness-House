import { NextResponse } from "next/server";
import { screenWorry, followup } from "@/lib/engine";
import { isTestSlug, testName } from "@/lib/tests";
import { cleanAnswers, cleanNickname, cleanWorry } from "@/lib/validate";

// 고민 쓰기(/{type}/worry) 다음에 어디로 갈지 정한다.
// 1) 안전 확인을 가장 먼저 — 위기면 위기 안내(/safety)로만 보내고 결과·결제로 넘어가지 않는다(설계 문서 7-7).
// 2) 짧은 고민이면 다시 묻기(/{type}/worry/followup), 아니면 계산(/{type}/calc).
// 고민 글은 로그에 남기지 않는다.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const slug = String(body.slug ?? "");
  if (!isTestSlug(slug)) return NextResponse.json({ error: "bad test" }, { status: 400 });
  const text = cleanWorry(body.text);
  const nickname = cleanNickname(body.nickname) ?? "";
  const answers = cleanAnswers(body.answers);

  if (text) {
    const s = await screenWorry(text);
    if (s.stop) return NextResponse.json({ next: "safety" });
  }
  if (!text) return NextResponse.json({ next: "calc" });

  try {
    const f = await followup(text, testName(slug), nickname, answers);
    if (f.ask && f.question) return NextResponse.json({ next: "followup", intro: f.intro, question: f.question });
  } catch {
    // 다시 묻기는 결과를 더 맞추는 보조 단계라, 실패하면 건너뛰고 계산으로 간다(안전 확인은 위에서 이미 끝남).
  }
  return NextResponse.json({ next: "calc" });
}
