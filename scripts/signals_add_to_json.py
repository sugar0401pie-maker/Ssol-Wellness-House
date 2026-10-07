# -*- coding: utf-8 -*-
"""판별 예시 문장 추가본(SSOL_Signals_Add_*.xlsx)의 signals_add 시트를 JSON으로 바꾼다.
사용법: python3 scripts/signals_add_to_json.py <xlsx> <out.json>
영역 한글 표기 규칙은 theory_library_to_json.py의 DOMAIN_KO와 같다. 이 추가본은 형식·길이 열 외에 gap(채운 빈 곳)·style을 갖고 있는데,
theory_signals 테이블에 칸이 없어서 메모 끝에 [gap/style]로 붙여 둔다(삭제하지 않음)."""
import sys, json, openpyxl

DOMAIN_KO = {"자기": "나 자신", "진로": "커리어", "연애": "연애", "관계": "관계", "육아": "육아", "인생": "삶의 방향"}
def s(v): return "" if v is None else str(v).strip()

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb["signals_add"]
rows = list(ws.iter_rows(values_only=True))
head = rows[0]
out = []
for r in rows[1:]:
    g = dict(zip(head, r))
    if not s(g.get("signal_id")): continue
    refl = s(g["reflection_text(공감 문장)"])
    memo = s(g["메모·경계"])
    tag = "/".join(x for x in (s(g["gap(채운 빈 곳)"]), s(g["style(쓰는 방식)"])) if x)
    out.append({"signal_id": s(g["signal_id"]), "theory_id": s(g["theory_id"]), "sub_process": s(g["sub_process"]),
                "domain": DOMAIN_KO.get(s(g["domain_code"]), s(g["domain_code"])), "situation": s(g["상황"]), "form": s(g["형식"]), "length_class": s(g["길이"]),
                "utterance": s(g["utterance(사용자 말투)"]), "reflection_text": None if refl in ("", "—") else refl, "reflection_ok": s(g["reflection_ok"]),
                "memo": (memo + (" " if memo else "") + (f"[{tag}]" if tag else "")).strip() or None})
json.dump({"signals": out}, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "문장 변환")
