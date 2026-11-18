# -*- coding: utf-8 -*-
"""CSO 묶음 v2.24(2026-11-18)의 새 실천 8종 + 실천↔이론 연결을 import_cso_v224.mjs가 읽는 JSON 한 개로 합친다.
사용법: python3 scripts/cso_v224_practices_to_json.py <03_실천 폴더> <출력 json>
표준 라이브러리만(엑셀 읽기는 cso_practices_to_json.py의 load를 그대로 씀). 원본 엑셀·JSON은 저장소에 커밋하지 않는다.
"""
import sys, os, json
src = open(os.path.join(os.path.dirname(__file__), "cso_practices_to_json.py"), encoding="utf-8").read()
ns = {}; exec(src.split("FILES = [")[0], ns)
D, OUT = sys.argv[1], sys.argv[2]
FILES = ["AstroPractices_v0.3", "RootStagePractices_v0.3", "AltFormatPractices_v0.1", "CopingObservePractices_v0.1", "CopingAcceptPractices_v0.1", "TheoryFillPractices_v0.1", "SceneTheoryPractices_v0.2", "RootInSessionPractices_v0.1"]
def table(wb, prefix, key):
    s = next(n for n in wb if n.startswith(prefix)); rows = wb[s]
    h = next(r for r in rows if key in r)
    return [dict(zip(h, r)) for r in rows[rows.index(h) + 1:] if r and r[0]]
out = {"practices": [], "links": [], "approved_ids": []}
for f in FILES:
    wb = ns["load"](os.path.join(D, f"SSOL_DB_{f}.xlsx"))
    for p in table(wb, "실천 제안", "ID"):
        p["_file"] = f; out["practices"].append(p)
pt = ns["load"](os.path.join(D, "SSOL_DB_PracticeTheory_v0.2.xlsx"))
out["links"] = table(pt, "전체 연결", "실천 id")
out["approved_ids"] = [r["실천 id"] for r in table(pt, "실천별 주 이론", "실천 id")]
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print(f"실천 {len(out['practices'])} · 연결 {len(out['links'])} · 라운드테이블 승인 목록 {len(out['approved_ids'])}")
