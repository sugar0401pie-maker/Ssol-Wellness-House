# -*- coding: utf-8 -*-
"""CSO 개발 전달 묶음(03_실천)의 실천 엑셀 4종을 import_cso_practices.mjs가 읽는 JSON 한 개로 합친다 (2026-10-27).
사용법: python3 scripts/cso_practices_to_json.py <03_실천 폴더> <출력 json 경로> [--theories]
- --theories: SSOL_DB_NewTheories6_v0.1.xlsx의 이론·개념·기법·질문·판별 문장·평가 문장·이론↔실천 연결 시트를 열 이름 그대로 한 JSON으로(import_cso_theories.mjs가 읽음)
- 표준 라이브러리만 쓴다(openpyxl 불필요). 원본 엑셀과 만든 JSON은 저장소에 커밋하지 않는다.
- 읽는 시트: 각 파일의 "실천 제안(N)"과 "적격성 상세(N)". 설명 다시 쓰기(DescRewrite)·이론 6개의 이론/개념/기법/질문/판별 문장은 따로 다룬다.
"""
import sys, zipfile, re, xml.etree.ElementTree as ET
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
def col(ref):
    s = re.match(r"[A-Z]+", ref).group(0); n = 0
    for c in s: n = n * 26 + ord(c) - 64
    return n - 1
def load(path):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            ss.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = {}
    for s in wb.find("m:sheets", NS):
        t = rels[s.get("{%s}id" % NS["r"])]
        t = t.lstrip("/"); t = t if t.startswith("xl/") else "xl/" + t
        rows = []
        for row in ET.fromstring(z.read(t)).iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS); typ = c.get("t")
                if typ == "s" and v is not None: val = ss[int(v.text)]
                elif typ == "inlineStr": val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
                else: val = v.text if v is not None else ""
                cells[col(c.get("r"))] = val
            if cells: rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        out[s.get("name")] = rows
    return out

FILES = [("SSOL_DB_RootPractices_NoChild_v0.1.xlsx", "실천 제안(30)", "적격성 상세(30)"), ("SSOL_DB_RootPractices_Thin2_v0.2.xlsx", "실천 제안(72)", "적격성 상세(72)"),
         ("SSOL_DB_RootPractices_v0.1.xlsx", "실천 제안(62)", "적격성 상세(62)"), ("SSOL_DB_NewTheories6_v0.1.xlsx", "실천 제안(107)", "적격성 상세(107)")]
def table(rows):
    h = rows[0]
    return [dict(zip(h, r + [""] * (len(h) - len(r)))) for r in rows[1:] if any(r)]
THEORY_SHEETS = {"theories": "이론(6)", "concepts": "개념(92)", "techniques": "기법(57)", "questions": "질문(564)", "signals": "판별 문장(183)", "eval": "평가 문장(90)", "links": "이론↔실천 연결(266)"}
if __name__ == "__main__":
    import json
    src, out = sys.argv[1], sys.argv[2]
    if "--theories" in sys.argv:
        d = load(src.rstrip("/") + "/SSOL_DB_NewTheories6_v0.1.xlsx")
        res = {k: table(d[v]) for k, v in THEORY_SHEETS.items()}
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        print({k: len(v) for k, v in res.items()}); sys.exit(0)
    practices, elig = [], {}
    for f, s1, s2 in FILES:
        d = load(src.rstrip("/") + "/" + f)
        for o in table(d[s1]): o["_file"] = f; practices.append(o)
        for o in table(d[s2]): elig[o["실천 ID"]] = o
    json.dump({"practices": practices, "elig": elig}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print("실천", len(practices), "적격성", len(elig))
