import type { NextConfig } from "next";

// 사주 엔진(engine/)은 설계 패키지 원본 그대로라 node:fs로 ../02_데이터/*.json을 직접 읽는다.
// 번들에 넣으면 그 경로가 깨지므로 Node가 그대로 불러오게 빼 두고(serverExternalPackages),
// 배포 묶음에 데이터 파일이 빠지지 않게 명시적으로 넣는다(outputFileTracingIncludes).
const nextConfig: NextConfig = {
  // 상위 폴더(메인 앱)를 작업 루트로 잘못 잡지 않게 이 앱 폴더를 루트로 못 박는다
  turbopack: { root: __dirname },
  serverExternalPackages: ["ssol-saju-engine", "manseryeok", "lunar-javascript"],
  outputFileTracingIncludes: {
    "/*": ["./engine/02_데이터/**/*", "./engine/03_코드/*.mjs", "./engine/package.json"],
  },
  outputFileTracingExcludes: {
    "/*": ["./engine/03_코드/test_*.mjs", "./engine/03_코드/*_fixture.json"],
  },
};

export default nextConfig;
