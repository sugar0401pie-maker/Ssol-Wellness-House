// 앱을 처음 열 때 필요한 서버 요청 4개(내 정보 확인·프로필·무료체험 상태·홈 데이터)를 "열자마자 동시에" 시작해 두는 모듈
// (2026-10-16 앱 첫 로딩 속도 개선). 이전에는 접속 확인 → 세션 확인 → 온보딩·프로필 → 홈 데이터 순서로 하나씩 기다려서 각 단계의
// 대기 시간이 그대로 더해졌다(운영에서 약 4~8초). 이제는 앞 단계를 기다리지 않고 한꺼번에 출발시키고, 화면은 필요한 시점에 이미
// 진행 중인 요청의 결과를 받아 쓴다. 결과를 못 받으면(실패·시간 지남) 호출한 쪽이 평소처럼 직접 요청한다 — 이 모듈은 속도만 높일 뿐
// 동작을 바꾸지 않는다.
//
// 주의 — 홈 데이터는 온보딩을 마친 사용자에게만 미리 받은 값을 쓴다. 온보딩을 아직 안 한 사용자는 온보딩 답을 저장한 "뒤에" 홈 데이터를
// 다시 받아야 개인화가 반영되므로(2026-09-24 버그 수정 기록, AppFrame 주석 참고), 그 경우 미리 받은 값은 버린다.

export type BootKey = "onboarding" | "profile" | "billing" | "daily";

export const BOOT_PATHS: Record<BootKey, string> = {
  onboarding: "/api/onboarding",
  profile: "/api/profile",
  billing: "/api/billing/status",
  daily: "/api/daily-practice",
};

export const BOOT_MAX_AGE_MS = 20_000; // 이 시간이 지나면 미리 받은 값은 낡았다고 보고 버린다

export type BootDeps = {
  getToken: () => Promise<string | null>;
  // token으로 path를 요청해 JSON을 돌려준다. 실패(오류·ok 아님)면 null.
  fetchJson: (path: string, token: string) => Promise<unknown | null>;
  now: () => number;
};

type Entry = { promise: Promise<unknown | null>; startedAt: number };

export function createBootstrap(deps: BootDeps) {
  let entries: Partial<Record<BootKey, Entry>> = {};
  let onboardingCompleted: boolean | null = null;

  const fresh = (e: Entry | undefined): e is Entry => !!e && deps.now() - e.startedAt <= BOOT_MAX_AGE_MS;

  return {
    // 아직 진행 중이거나 낡지 않은 요청이 있으면 아무것도 하지 않는다(여러 곳에서 불러도 한 번만 출발).
    start(): void {
      const hasFresh = (Object.keys(BOOT_PATHS) as BootKey[]).some((k) => fresh(entries[k]));
      if (hasFresh) return;
      entries = {};
      onboardingCompleted = null;
      const tokenPromise = deps.getToken().catch(() => null);
      for (const key of Object.keys(BOOT_PATHS) as BootKey[]) {
        entries[key] = {
          startedAt: deps.now(),
          promise: tokenPromise.then((token) => (token ? deps.fetchJson(BOOT_PATHS[key], token).catch(() => null) : null)),
        };
      }
    },
    // 미리 시작해 둔 요청을 한 번만 넘겨준다(가져가면 비워서 다음 호출은 평소처럼 직접 요청). 없거나 낡았으면 null.
    take<T>(key: BootKey): Promise<T | null> | null {
      const e = entries[key];
      delete entries[key];
      if (!fresh(e)) return null;
      return e.promise as Promise<T | null>;
    },
    // AppFrame이 온보딩 확인 결과를 알려 주면 홈 데이터를 미리 받은 값으로 써도 되는지 정한다.
    setOnboardingCompleted(v: boolean): void {
      onboardingCompleted = v;
    },
    // 홈 데이터는 온보딩을 이미 마친 사용자일 때만 미리 받은 값을 쓴다(온보딩을 방금 마치는 사용자는 저장 후의 값이 필요).
    takeDaily<T>(): Promise<T | null> | null {
      if (onboardingCompleted !== true) {
        delete entries.daily;
        return null;
      }
      return this.take<T>("daily");
    },
  };
}
