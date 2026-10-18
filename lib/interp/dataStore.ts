import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as K from "./vendor/claimClassifier.mjs";
import { buildClaims, buildScenes, type Claim, type Scene } from "./claims";
import { buildClaimIndex, claimTexts, type ClaimIndex } from "./search";
import { embedTexts } from "./embed";

// 분류기가 쓰는 데이터(의미 사전·장면)를 DB(sw_ob_*)에서 읽어 서버 메모리에 둔다(10분). 원본은 DB 표이고 JSON은 시험용이다.
// 후보 검색용 임베딩 색인은 처음 쓸 때 한 번 만든다(claim 문장 약 천여 개 → 임베딩 호출 몇 번). 인스턴스가 새로 뜰 때마다 다시 만든다.
type Admin = ReturnType<typeof createAdminClient>;
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; claims: Claim[]; scenes: Scene[]; index: Promise<ClaimIndex>; sig: string } | null = null;
// claim 문장이 그대로면 10분마다 임베딩을 다시 만들지 않는다(색인 만들기는 한 번에 약 10초·호출 몇 번).
const signature = (claims: Claim[]) => claims.map((c) => c.claim_id + "|" + claimTexts(c).join("¶")).join("\n");

async function rows<T>(admin: Admin, table: string, cols: string): Promise<T[]> {
  const { data, error } = await admin.from(table).select(cols).limit(5000);
  if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
  return (data ?? []) as T[];
}

let loading: Promise<{ claims: Claim[]; scenes: Scene[]; index: ClaimIndex }> | null = null;

// 여러 요청이 동시에 와도 읽기·임베딩 색인 만들기는 한 번만 한다(singleflight) — 같은 일을 겹쳐 하면 시간과 비용이 낭비되고 OpenAI 제한에 걸리기 쉽다.
export function getClassifierData(admin: Admin): Promise<{ claims: Claim[]; scenes: Scene[]; index: ClaimIndex }> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index.then((index) => ({ claims: cache!.claims, scenes: cache!.scenes, index }));
  if (!loading) loading = load(admin).finally(() => { loading = null; });
  return loading;
}

async function load(admin: Admin): Promise<{ claims: Claim[]; scenes: Scene[]; index: ClaimIndex }> {
  const [claims, claimRoots, options, roots, scenes] = await Promise.all([
    rows<Parameters<typeof buildClaims>[0][number]>(admin, "sw_ob_claims", "claim_id,label,kind,scenes,examples_json,lean_json,counter_json,core_thoughts_json,show_if,generic,points,signal_ids"),
    rows<Parameters<typeof buildClaims>[1][number]>(admin, "sw_ob_claim_roots", "claim_id,root_id,link,polarity,cond"),
    rows<Parameters<typeof buildClaims>[2][number]>(admin, "sw_ob_choice_options", "option_id,claim_id"),
    rows<Parameters<typeof buildClaims>[3][number]>(admin, "sw_ob_roots", "root_id,name,nature_primary,nature_secondary"),
    rows<Parameters<typeof buildScenes>[0][number]>(admin, "sw_ob_choice_scenes", "scene_key,name,module,first_card_id,open_when"),
  ]);
  const c = buildClaims(claims, claimRoots, options, roots), s = buildScenes(scenes);
  K.setData({ claims: c, scenes: s });
  const sig = signature(c);
  const index = cache && cache.sig === sig ? cache.index : buildClaimIndex(c, embedTexts);
  const entry = { at: Date.now(), claims: c, scenes: s, index, sig };
  cache = entry;
  index.catch(() => { if (cache === entry) cache = null; }); // 임베딩이 실패하면 다음 요청에서 다시 시도
  return { claims: c, scenes: s, index: await index };
}
