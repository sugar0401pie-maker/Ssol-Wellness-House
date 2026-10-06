# -*- coding: utf-8 -*-
"""이론 라이브러리 엑셀(SSOL_Theory_Library_*.xlsx, 표준 양식)을 import_theory_library.mjs가 읽는 JSON 한 개로 합친다.

사용법: python3 scripts/theory_library_to_json.py <엑셀 폴더> <출력 json 경로>
- 원본 엑셀과 만들어진 JSON은 다른 지식 소스 파일처럼 저장소에 커밋하지 않는다.
- 수식 칸은 엑셀에 저장된 계산 값을 읽는다(openpyxl data_only). 값이 비어 있는 수식은 빈 문자열 결과다.
- 영역·실행 단계 한글 표기를 DB 값으로 바꾸는 규칙은 여기 한 곳에만 둔다(DOMAIN_KO, TIER_KO, CATEGORY_KO).
"""
import sys, glob, json, re, openpyxl

DOMAIN_KO = {"자기": "나 자신", "진로": "커리어", "연애": "연애", "관계": "관계", "육아": "육아", "인생": "삶의 방향"}
TIER_KO = {"가볍게": "가볍게 시작", "꾸준히": "꾸준히 이어가기", "장기": "장기 습관·정체성으로"}
# 시범 정렬본의 세부유형 코드 → DB category(한글). 기존 575개·신규 200개가 쓰는 이름과 맞춘다.
# SKILLS·PLANNING 두 가지는 기존에 없던 분류라 새 한글 이름을 붙였다(owner가 바꿔도 이 표만 고치면 된다).
CATEGORY_KO = {
    "MIND": "생각 전환하기", "VALUES": "가치 점검하기", "TALK": "관계·대화로 풀기", "CARE": "나를 돌보기", "HELP": "도움 요청하기",
    "SKILLS": "기술 익히기", "PLANNING": "계획 세우기", "TASK_DESIGN": "업무 설계하기", "CHILD_DIALOGUE": "아이와 대화하기",
    "NEW_CONNECTIONS": "새로운 관계 넓히기", "BOUNDARIES": "선 지키기", "MESSAGES": "마음 전하기", "CARE_SUPPORT": "돌봄 지원 챙기기",
    "SENSORY": "감각 알아차리기", "CREATIVE": "창작으로 표현하기", "TOGETHER": "함께하는 시간",
}
PLAY_BY_DOMAIN = {"육아": "아이와 놀기", "연애": "함께 즐기기"}   # PLAY는 영역마다 이름이 다르다(그 외는 쉬어가기)

CODE_OF_DOMAIN = {"나 자신": "SELF", "커리어": "WORK", "연애": "COUPLE", "관계": "REL", "육아": "PARENT"}

def audience(sheet_code, secondary):
    """practice_eligibility.audience_mode(SELF/REL/COUPLE/WORK/PARENT). 1순위가 '인생'인 행은 합본 시트의 영역 열이
    'LIFE(확인필요 C-5)' 같은 임시값이라, 2순위 영역에서 코드를 따오고 없으면 SELF로 둔다."""
    if sheet_code in ("SELF", "REL", "COUPLE", "WORK", "PARENT"): return sheet_code
    for d in secondary:
        if d in CODE_OF_DOMAIN: return CODE_OF_DOMAIN[d]
    return "SELF"

def rows(ws):
    r = list(ws.iter_rows(values_only=True))
    if not r: return []
    H = [str(h) if h is not None else "" for h in r[0]]
    return [dict(zip(H, x)) for x in r[1:] if any(v is not None for v in x)]

def s(v):
    return "" if v is None else str(v).strip()

def truthy(v):
    return v is True or str(v).strip().lower() in ("true", "y", "예")

def codes(v):
    return [x for x in re.split(r"[|,;\s]+", s(v)) if x]

def num(v):
    try: return int(float(v))
    except (TypeError, ValueError): return None

def main(folder, out):
    files = sorted(glob.glob(folder.rstrip("/") + "/SSOL_Theory_Library_*.xlsx"))
    if not files: raise SystemExit("엑셀 파일을 찾지 못했습니다: " + folder)
    data = {"theories": [], "concepts": [], "techniques": [], "questions": [], "signals": [], "practices": [], "links": [], "eval": [], "sourceFiles": []}
    for f in files:
        wb = openpyxl.load_workbook(f, data_only=True)
        data["sourceFiles"].append(f.split("/")[-1])
        for t in rows(wb["theory"]):
            if not s(t.get("theory_id")): continue
            data["theories"].append({
                "theory_id": s(t["theory_id"]), "internal_name": s(t["internal_name"]), "name_en": s(t["name_en"]),
                "plain_focus": s(t["plain_focus(사용자용 한 줄)"]), "lineage": s(t["lineage"]), "founders": s(t["founders"]),
                "source_book": s(t["source_book"]), "book_type": s(t["book_type"]), "service_role": s(t["service_role"]),
                "domain_rank1": DOMAIN_KO.get(s(t["domain_rank1"]), s(t["domain_rank1"])) or None,
                "domain_rank2": DOMAIN_KO.get(s(t["domain_rank2"]), s(t["domain_rank2"])) or None,
                "domain_rank3": DOMAIN_KO.get(s(t["domain_rank3(선택)"]), s(t["domain_rank3(선택)"])) or None,
                "rank1_score": num(t["rank1_score"]), "rank2_score": num(t["rank2_score"]), "rank3_score": num(t["rank3_score"]),
                "is_common_module": s(t["is_common_module"]) == "Y", "rank_basis": s(t["rank_basis"]), "theory_axes": s(t["theory_axes"]),
                "allowed_routes": [x.strip() for x in s(t["allowed_routes"]).split(",") if x.strip()],
                "exclude_conditions": [x.strip() for x in s(t["exclude_conditions"]).split(" / ") if x.strip()],
                "prefer_other_when": s(t["prefer_other_when(KB)"]), "persona_flag": s(t["persona_flag"]),
                "voice_card": {"question_style": s(t["voice_card.question_style"]), "vocab": s(t["voice_card.vocab"]),
                               "stance": s(t["voice_card.stance"]), "forbidden": s(t["voice_card.forbidden"])},
                "overlay": s(t["overlay(금지·주의 요약)"]), "max_explore_turns": num(t["max_explore_turns"]),
                "explore_turns_typical_min": num(t["explore_turns_typical_min"]), "explore_turns_typical_max": num(t["explore_turns_typical_max"]),
                "clinical_sensitive": s(t["clinical_sensitive"]) == "Y", "parenting_note": s(t["육아 연결(D8)"]), "review_notes": s(t["review_notes"]),
            })
        for c in rows(wb["concepts"]):
            if not s(c.get("concept_id")): continue
            data["concepts"].append({"concept_id": s(c["concept_id"]), "theory_id": s(c["theory_id"]), "name_ko": s(c["name_ko"]), "name_en": s(c["name_en"]),
                "definition": s(c["definition(KB)"]), "plain_language": s(c["plain_language(일상어 — 왜 묻나)"]),
                "growth_frame": s(c["growth_frame(성장 프레임 — 어디로 가나)"]), "domains_note": s(c["연결 영역(KB 원문)"]),
                "domains_ranked": s(c["domains_ranked"])})
        for t in rows(wb["techniques"]):
            if not s(t.get("technique_id")): continue
            data["techniques"].append({"technique_id": s(t["technique_id"]), "theory_id": s(t["theory_id"]), "number": s(t["번호"]), "name": s(t["기법명"]),
                "sub_process": s(t["sub_process(이론 축)"]), "domains_ranked": s(t["domains_ranked"]), "timing": s(t["사용 시점"]), "purpose": s(t["목적"]),
                "guidance_level": s(t["guidance_level"]), "steps": s(t["진행 방식"]), "common_mistake": s(t["흔한 실수"]), "homework": s(t["과제화(KB)"]),
                "ui_idea": s(t["연출 아이디어"]), "exposure_candidate": s(t["KB 힘 빼는 훈련 후보"]), "example_utterances": s(t["예시 발화(KB)"]),
                "linked_practices": s(t["연결 실천"]), "main_concept_id": s(t["주 개념 concept_id"]) or None})
        for q in rows(wb["questions"]):
            if not s(q.get("question_id")): continue
            chat = s(q["question_text_chat(채팅용)"]); orig = s(q["question_text_original(KB 원문)"])
            enabled = bool(chat) and "미사용" not in chat
            data["questions"].append({"question_id": s(q["question_id"]), "theory_id": s(q["theory_id"]), "source": s(q["source"]),
                "technique_id": s(q["technique_id"]) or None, "stage": s(q["stage"]), "sub_process": s(q["sub_process"]),
                "question_text_original": orig, "question_text": chat if enabled else orig, "chat_enabled": enabled,
                "modify_note": s(q["수정 여부·사유"]), "intent": s(q["intent(검수·AI 가이드용)"]), "concept_id": s(q["concept_id"]) or None,
                "why_ask": s(q["묻는 이유(일상어)"]), "growth_direction": s(q["이어질 방향(성장 프레임)"])})
        for g in rows(wb["signals"]):
            if not s(g.get("signal_id")): continue
            refl = s(g["reflection_text(공감 문장)"])
            data["signals"].append({"signal_id": s(g["signal_id"]), "theory_id": s(g["theory_id"]), "sub_process": s(g["sub_process"]),
                "domain": DOMAIN_KO.get(s(g["domain_code"]), s(g["domain_code"])), "situation": s(g["상황"]), "form": s(g["형식"]), "length_class": s(g["길이"]),
                "utterance": s(g["utterance(사용자 말투)"]), "reflection_text": None if refl in ("", "—") else refl, "reflection_ok": s(g["reflection_ok"]),
                "memo": s(g["메모·겹침 주의"]), "negative_type": s(g["negative_type(부정 발언)"]) or None, "negative_response": s(g["negative_response(북돋움 응답)"]) or None})
        for p in rows(wb["practices_new"]):
            pid = s(p.get("ID"))
            if not pid: continue
            first = DOMAIN_KO[s(p["1순위"])]
            sec = [DOMAIN_KO[x] for x in (s(p["2순위(최종)"]), s(p["3순위(선택)"])) if x in DOMAIN_KO]
            code = s(p["세부유형"]); cat = CATEGORY_KO.get(code) or (PLAY_BY_DOMAIN.get(first, "쉬어가기") if code == "PLAY" else None)
            if not cat: raise SystemExit(f"세부유형 매핑이 없습니다: {pid} {code}")
            stage = s(p["실행단계"])
            data["practices"].append({"id": pid, "domain": first, "secondary_domains": sec, "category": cat, "tier": TIER_KO[stage],
                "title": s(p["최종 제목"]), "detail": s(p["최종 설명"]), "availability": s(p["availability"]) or "general", "exposure_flag": s(p["exposure_flag"]) == "Y",
                "exposure_step": num(p["exposure_step"]), "coping_fit": s(p["coping_fit"]) or None, "concept_id": s(p["concept_id"]) or None,
                "suggest_reason": s(p["제안 이유(사용자용 한 줄)"]) or None, "source_theory_id": s(p["source_theory_id"]), "source_technique": s(p["source_technique"]) or None,
                "audience_mode": audience(s(p["영역(DB, 1순위)"]), sec),
                "requires_partner": truthy(p["파트너필요"]), "requires_childcare": truthy(p["돌봄필요"]), "requires_work": truthy(p["재직필요"]),
                "q4": codes(p["가치관코드(Q4)"]), "q5": codes(p["취미코드(Q5)"]), "q6": codes(p["주말코드(Q6)"]), "q7": codes(p["고민코드(Q7)"]), "q9": codes(p["제외코드(Q9)"]),
                "min_minutes": num(p["예상최소분"]), "max_minutes": num(p["예상최대분"]), "safety_memo": s(p["안전·검수 메모"])})
        for k in rows(wb["links_575"]):
            if not s(k.get("theory_id")): continue
            data["links"].append({"theory_id": s(k["theory_id"]), "concept_or_technique": s(k["개념·기법"]), "practice_id": s(k["practice_id"]),
                "compatibility": s(k["compatibility"]), "relation": s(k["relation"]), "basis": s(k["근거"])})
        for e in rows(wb["eval_seed"]):
            if not s(e.get("eval_id")): continue
            data["eval"].append({"eval_id": s(e["eval_id"]), "utterance": s(e["utterance"]), "expected_label": s(e["expected(정답 라벨)"]), "check_point": s(e["확인 포인트"]), "written_by": s(e["written_by"])})
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in data.items() if isinstance(v, list)})

if __name__ == "__main__":
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
