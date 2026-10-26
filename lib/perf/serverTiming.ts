// 서버 응답에 "어느 단계가 몇 ms 걸렸는지"를 Server-Timing 헤더로 싣는다(2026-10-16, 앱 첫 로딩 속도 개선 작업).
// 브라우저 개발자도구(Network → Timing)나 스크립트에서 읽을 수 있고, 단계 이름과 시간(ms)만 들어 있어 민감한 정보가 없다.
// 운영에서 어디가 느린지(인증·DB 조회·실천 목록 등) 추측이 아니라 숫자로 보기 위한 용도다.
export type Timer = {
  // 이미 시작한 작업(promise)의 소요 시간을 name으로 기록하고 결과를 그대로 돌려준다(병렬 작업에 쓴다).
  time<T>(name: string, work: Promise<T>): Promise<T>;
  // 지금까지 걸린 시간을 name으로 기록한다.
  mark(name: string): void;
  // 직전 lap(또는 시작)부터 지금까지 걸린 시간을 name으로 기록한다 — 순서대로 이어지는 단계를 하나씩 재는 데 쓴다.
  lap(name: string): void;
  // Server-Timing 헤더 값(예: "auth;dur=1.2, db;dur=80.5, total;dur=95.3").
  header(): string;
};

function cleanName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function createTimer(now: () => number = () => performance.now()): Timer {
  const start = now();
  let last = start;
  const entries: { name: string; dur: number }[] = [];
  return {
    time(name, work) {
      const s = now();
      return work.finally(() => {
        entries.push({ name: cleanName(name), dur: now() - s });
      });
    },
    mark(name) {
      entries.push({ name: cleanName(name), dur: now() - start });
    },
    lap(name) {
      const t = now();
      entries.push({ name: cleanName(name), dur: t - last });
      last = t;
    },
    header() {
      const all = [...entries, { name: "total", dur: now() - start }];
      return all.map((e) => `${e.name};dur=${e.dur.toFixed(1)}`).join(", ");
    },
  };
}
