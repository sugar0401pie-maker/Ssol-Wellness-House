// 빌드 전에 사주 엔진(engine/)을 비공개 GitHub 저장소에서 받아 온다(npm run build 앞에 자동 실행 — package.json "prebuild").
// 엔진(문장 DB·고민 판별기·안전 낱말 원본)은 이 저장소가 공개라 여기 올리지 않는다(engine_kit/와 같은 원칙).
//
// 필요한 환경 변수(Vercel → Settings → Environment Variables):
//   ENGINE_REPO          비공개 저장소 이름, 예) sugar0401pie-maker/ssol-saju-engine
//   ENGINE_REF           받을 판(태그·브랜치), 예) v1.16.0
//   ENGINE_GITHUB_TOKEN  그 저장소만 읽을 수 있는 GitHub 토큰(fine-grained, Contents: Read-only)
//
// 로컬처럼 engine/이 이미 있으면 아무것도 하지 않는다. 받다가 실패하면 빌드를 멈춘다(엔진 없이 배포되면 사주 계산이 안 되므로).
// 토큰은 로그에 찍지 않는다.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const engineDir = path.join(root, "engine");
const marker = path.join(engineDir, "03_코드", "report.mjs");

if (existsSync(marker)) {
  console.log("[engine] engine/ 있음 — 받지 않고 그대로 씀");
  process.exit(0);
}

const repo = process.env.ENGINE_REPO;
const ref = process.env.ENGINE_REF || "main";
const token = process.env.ENGINE_GITHUB_TOKEN;
if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(ref)) {
  console.error("[engine] engine/이 없고 ENGINE_REPO · ENGINE_GITHUB_TOKEN 환경 변수도 없어요. saju/README.md '배포 순서'를 보세요.");
  process.exit(1);
}

const res = await fetch(`https://api.github.com/repos/${repo}/tarball/${encodeURIComponent(ref)}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ssol-saju-build" },
  redirect: "follow",
});
if (!res.ok) {
  console.error(`[engine] 엔진 저장소를 받지 못했어요(HTTP ${res.status}). 저장소 이름·판·토큰 권한을 확인해 주세요.`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `saju-engine-${Date.now()}.tar.gz`);
writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
rmSync(engineDir, { recursive: true, force: true });
mkdirSync(engineDir, { recursive: true });
// GitHub tarball은 맨 위에 {owner}-{repo}-{sha}/ 폴더가 하나 있어 한 단계 벗겨 낸다
execFileSync("tar", ["-xzf", tmp, "-C", engineDir, "--strip-components=1"]);
rmSync(tmp, { force: true });

if (!existsSync(marker)) {
  console.error("[engine] 받은 저장소에 03_코드/report.mjs가 없어요. 엔진 저장소 맨 위에 02_데이터 · 03_코드가 있어야 해요.");
  process.exit(1);
}
console.log(`[engine] ${repo}@${ref} 받음`);
