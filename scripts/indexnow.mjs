// IndexNow 제출 스크립트 — 운영(production) 배포가 끝난 뒤, 바뀐 페이지를 검색엔진(Bing·네이버 등)에 알려줍니다.
// 사용: SITE_URL=https://사이트 INDEXNOW_KEY=키 node scripts/indexnow.mjs
//  - INDEXNOW_KEY 또는 SITE_URL이 없으면 아무것도 하지 않고 종료합니다.
//  - /sitemap.xml에서 URL을 읽어, lastmod가 오늘(한국 날짜)인 것만 보냅니다. 사이트맵에 lastmod가 하나도 없으면 전체 URL을 보냅니다.
//  - 로그인·결제·결과·마이페이지·관리자 같은 주소와 사이트맵에 없는 주소는 보내지 않습니다.
//  - 1회만 호출하고 재시도하지 않습니다. 성공·실패와 관계없이 항상 종료 코드 0으로 끝납니다(배포를 실패 처리하지 않음).
// 수동 점검용 환경변수: INDEXNOW_DRY_RUN=1(보내지 않고 목록만 출력), INDEXNOW_URLS=주소1,주소2(사이트맵 안의 주소만 골라서 보냄)
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 10000;
const EXCLUDE = /\/(login|signup|reset-password|auth|checkout|result|results|history|match|mypage|admin|api|chat|report|session-reserve|start|quiz)(\/|$)|\/pricing\/(success|fail)(\/|$)/i;

const log = (...args) => console.log("[indexnow]", ...args);

function parseSitemap(xml) {
  const entries = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] ?? null;
    entries.push({ loc: loc.replace(/&amp;/g, "&"), lastmod });
  }
  return entries;
}

async function main() {
  const key = (process.env.INDEXNOW_KEY || "").trim();
  const site = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (!key || !site) {
    log("INDEXNOW_KEY 또는 SITE_URL이 없어 아무것도 하지 않고 종료합니다.");
    return;
  }
  const { origin, host } = new URL(site);

  const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    log(`sitemap.xml을 읽지 못했습니다(HTTP ${res.status}). 종료합니다.`);
    return;
  }
  const entries = parseSitemap(await res.text()).filter((e) => {
    try {
      const u = new URL(e.loc);
      return u.host === host && !EXCLUDE.test(u.pathname);
    } catch {
      return false;
    }
  });
  if (entries.length === 0) {
    log("제출할 수 있는 주소가 사이트맵에 없습니다.");
    return;
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); // YYYY-MM-DD
  const hasLastmod = entries.some((e) => e.lastmod);
  let urls = hasLastmod ? entries.filter((e) => e.lastmod && e.lastmod.slice(0, 10) === today) : entries;
  urls = urls.map((e) => e.loc);

  const only = (process.env.INDEXNOW_URLS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (only.length) urls = entries.map((e) => e.loc).filter((u) => only.includes(u));

  urls = [...new Set(urls)].slice(0, MAX_URLS);
  if (urls.length === 0) {
    log(`오늘(${today}) 바뀐 페이지가 없어 제출하지 않습니다.`);
    return;
  }
  log(`${host}: ${urls.length}개 제출 대상`);
  urls.forEach((u) => log(" -", u));
  if (process.env.INDEXNOW_DRY_RUN) {
    log("INDEXNOW_DRY_RUN이 켜져 있어 보내지 않습니다.");
    return;
  }

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: urls }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 200 || r.status === 202) {
    log(`성공: HTTP ${r.status}`);
  } else {
    log(`실패: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}`);
  }
}

main()
  .catch((err) => log("오류(배포에는 영향 없음):", err?.message || err))
  .finally(() => process.exit(0));
