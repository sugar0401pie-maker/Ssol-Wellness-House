import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 외부(CSO) 코드 보관본 — 수정하지 않으므로 lint 대상에서 뺀다
    "lib/interp/vendor/**",
    "lib/cards/vendor/**",
    // CSO 엔진 시험 묶음(git 제외 폴더 — 원본 시험 코드 그대로)
    "engine_kit/**",
    // 사주 앱(saju.ssolwellnesshouse.com)은 따로 배포하는 별도 Next 앱 — 자기 eslint 설정을 쓴다
    "saju/**",
  ]),
]);

export default eslintConfig;
