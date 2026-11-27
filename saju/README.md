# 살로 풀어보는 2027년 사주 — saju.ssolwellnesshouse.com

메인 앱(쏘웰라)과 **따로 배포하는** Next.js 앱입니다. 4종(연애운·직장운·재물운·종합사주)은 같은 엔진을 쓰고 `test_type`만 다릅니다.

## 주소 (모든 화면에 개별 링크 — hard rule)

| 화면 | 주소 |
|---|---|
| 허브 | `/` |
| 테스트 첫 화면 | `/{type}` — type = `love` · `career` · `money` · `total` |
| 닉네임 · 생년월일 · 확인 | `/{type}/welcome` · `/{type}/birth` · `/{type}/birth/confirm` |
| 고민 · 다시 묻기 | `/{type}/worry` · `/{type}/worry/followup` |
| 계산 · 계산 끝 · 기다림 | `/{type}/calc` · `/{type}/calc/done?result=…` · `/{type}/loading?result=…` |
| 결과 1~14쪽 · 대표 살 | `/result/{id}/{쪽}` · `/result/{id}/sal/1~3` · 결제 뒤 `?opened=1` |
| 결제 | `/checkout/{id}?page=쪽` |
| 공유 · 살 소개 · 위기 안내 | `/share/{id}` · `/about-sal` · `/safety` |
| 이전 결과 · 로그인 | `/history` · `/login?next=…` |

## 실행

```bash
cd saju && npm install && npm run dev   # http://localhost:3200
npm test                                # 앱 단위 테스트(가격·챌린지·입력 검사)
npm run test:engine                     # 엔진 원본 테스트 일부
```

## 엔진(`engine/`)

- 설계 패키지의 `02_데이터` + `03_코드`를 **그대로** 옮긴 것. 고치지 말고, 새 판이 오면 폴더째 바꿉니다.
- **git에 올리지 않습니다**(저장소가 공개라서 — 문장 DB·고민 판별기·안전 낱말 원본 보호, `engine_kit/`와 같은 원칙).
  배포 때 엔진을 어떻게 넣을지는 정해야 합니다(아래 '배포 전 할 일').
- 화면 문구는 `engine/02_데이터/ui_copy.json`, 가격은 `pricing.json`에서만 읽습니다.

## 쏘웰라로 넘기는 작심삼일 챌린지

결과를 만들 때 엔진의 챌린지를 쏘웰라가 쏠 타로에서 받는 모양과 똑같이 바꿔 저장합니다(`lib/challenge.ts`):

```json
{ "day1": {"title","description"}, "day2": …, "day3": …, "week": {"title":"1주일 이어 가기",…}, "month": {"title":"1달 이어 가기",…} }
```

쏘웰라로 가는 주소: `https://app.ssolwellnesshouse.com/challenge?from=saju&result={결과 번호}`
쏘웰라 쪽에서 `from=saju`를 받아 `saju_results.report->'challenge'`를 읽는 부분은 메인 앱에 따로 만들어야 합니다.

## 결제 · 공유 · 저장 (환경 변수 이름은 `.env.example`)

- **결과 저장**: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`가 있으면 Supabase `saju_results`, 없으면 로컬 파일(개발용, Vercel에서는 막힘).
- **토스 결제**: `NEXT_PUBLIC_TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY`(결제창 = API 개별 연동 키)가 있으면 토스 결제창.
  돌아오는 곳 `/checkout/{id}/success`에서 서버가 주문 번호·금액을 확인하고 토스 승인 API가 `DONE`을 줄 때만 결제 완료로 기록.
  취소·실패는 `/checkout/{id}/fail`. 키가 없으면 로컬에서만 개발용 가짜 결제.
- **카카오톡 공유**: `NEXT_PUBLIC_KAKAO_JS_KEY`가 있으면 `/share/{id}`의 노란 버튼이 카카오톡 공유, 없으면 기기 공유 창·링크 복사.

## 배포 순서

1. **SQL 실행** — Supabase 대시보드 → SQL Editor에서 `supabase/saju_results.sql`을 한 번 실행.
2. **엔진 넣는 방법 정하기** — `engine/`은 공개 저장소에 없어서 이대로는 Vercel 빌드가 실패합니다(비공개 저장소·비공개 패키지 등).
3. **Vercel 새 프로젝트** — 같은 GitHub 저장소, Root Directory = `saju`, 환경 변수 넣기(`.env.example`).
4. **도메인** — Vercel에 `saju.ssolwellnesshouse.com` 추가 → Cloudflare에 CNAME.
5. **토스** — 테스트 키로 결제·취소를 한 번씩 해 본 뒤 운영 키로 바꾸기.
6. **카카오** — Kakao Developers → 플랫폼 → Web에 `https://saju.ssolwellnesshouse.com` 등록.
7. **로그인 연결**(아직) — 쏘웰라와 같은 Supabase 계정, 쿠키 도메인 `.ssolwellnesshouse.com`. 연결되면 결과에 `user_id`를 채워 쏘웰라가 챌린지를 읽을 수 있게 한다.
8. **위기 화면 문구 상담사 승인**(ui_copy.safety.to_check — 승인 없이 나가면 출시 차단 항목).
