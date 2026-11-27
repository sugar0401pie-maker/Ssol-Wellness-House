import { NextResponse } from "next/server";
import { buildResult, composeFollowup, screenWorry, timeNote } from "@/lib/engine";
import { handoffChallenge } from "@/lib/challenge";
import { newResultId, saveResult } from "@/lib/store";
import { isTestSlug, testName } from "@/lib/tests";
import { cleanAnswers, cleanBirth, cleanNickname, cleanWorry } from "@/lib/validate";

// 계산 화면(/{type}/calc)이 부른다: 입력을 다시 검사 → 안전 확인 → 엔진으로 결과 조립 → 저장 → 결과 번호.
// 위기면 결과를 만들지도 저장하지도 않는다. 생년월일·고민 글은 로그에 남기지 않는다.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const slug = String(body.slug ?? "");
  const nickname = cleanNickname(body.nickname);
  const birth = cleanBirth(body.birth);
  if (!isTestSlug(slug) || !nickname || !birth || body.ageOk !== true) {
    return NextResponse.json({ error: "입력을 다시 확인해 주세요." }, { status: 400 });
  }
  const worry = await composeFollowup(cleanWorry(body.worry), cleanAnswers(body.answers));

  // 서버에서 한 번 더 안전 확인(화면 단계를 건너뛰고 바로 부른 경우도 막는다). 판단 실패 = 위기 쪽으로.
  const s = worry ? await screenWorry(worry) : { level: "none" as const, stop: false };
  if (s.stop) return NextResponse.json({ next: "safety" });

  let page;
  try {
    page = await buildResult(birth, testName(slug), worry, nickname);
  } catch {
    return NextResponse.json({ error: "사주를 계산하지 못했어요. 생년월일을 다시 확인해 주세요." }, { status: 422 });
  }
  if (page.stop) return NextResponse.json({ next: "safety" });

  const id = newResultId();
  await saveResult({
    id,
    slug,
    createdAt: new Date().toISOString(),
    nickname,
    worry,
    page,
    paid: false,
    paidAt: null,
    safetyLevel: s.level,
    timeNote: await timeNote(birth),
    challenge: handoffChallenge(page.challenge),
  });
  return NextResponse.json({ next: "result", id });
}
