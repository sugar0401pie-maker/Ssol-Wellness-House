# -*- coding: utf-8 -*-
# 바다 친구 그림(zip 분류표) + 문안 표(sea_text.md — '| 번호 | 제목 | 본문 |' 줄 66개) → public/sea-friends/<지문>.webp(같은 그림은 한 장만) + lib/seaFriends/data.ts
# 사용법: python3 -X utf8 scripts/sea_friends_build.py <sea_text.md가 있는 폴더> <저장소 폴더> <그림 zip을 푼 폴더>
# 문안 표 원본은 docs/백업_비공개/sea_text.md(git 제외). 그림 원본 zip은 저장소에 넣지 않는다.
import json, sys, os, hashlib, shutil
S, R, ZIPDIR = sys.argv[1], sys.argv[2], sys.argv[3]
cls = json.load(open(os.path.join(ZIPDIR, "분류표.json"), encoding="utf-8"))
items = {}
for line in open(os.path.join(S, "sea_text.md"), encoding="utf-8"):
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 3: continue
    name = c[0].rsplit("-", 1)[0]
    items.setdefault(name, []).append({"id": c[0], "title": c[1], "body": c[2]})
check = {"물범-2": "수염 흔적 추적 연구는 항구물범 기준", "원앙-1": "'대부분 다치지 않는다' 근거", "왜가리-3": "한 다리 서기 이유는 가설", "복어-2": "독이 먹이·세균에서 온다는 설명(전문가 확인)",
         "거북-1": "캐릭터(둥근 돔 등껍질)와 바다거북 이야기가 맞는지", "거북-2": "캐릭터(둥근 돔 등껍질)와 바다거북 이야기가 맞는지", "거북-3": "캐릭터(둥근 돔 등껍질)와 바다거북 이야기가 맞는지",
         "조개-1": "진주를 만드는 조개류 이야기", "물개-1": "물개/바다사자 종 이름 확인", "물개-2": "물개/바다사자 종 이름 확인", "물개-3": "물개/바다사자 종 이름 확인", "개구리-1": "숲개구리는 북미 종",
         "해파리-2": "수영 효율 연구", "해파리-3": "불멸의 해파리는 한 종의 이야기", "불가사리-1": "재생은 종마다 다름", "불가사리-3": "위 반출은 종마다 다름", "펭귄-2": "허들링은 황제펭귄 이야기"}
out_dir = os.path.join(R, "public", "sea-friends")
shutil.rmtree(out_dir, ignore_errors=True); os.makedirs(out_dir)
seen = {}
out = []
for key, v in cls.items():
    imgs = []
    for im in v["images"]:
        src = os.path.join(ZIPDIR, im["file"])
        h = hashlib.sha1(open(src, "rb").read()).hexdigest()[:12]
        if h not in seen:
            shutil.copyfile(src, os.path.join(out_dir, h + ".webp")); seen[h] = im["file"]
        if h not in imgs: imgs.append(h)
    its = items[v["name"]]
    for it in its:
        if it["id"] in check: it["check"] = check[it["id"]]
    out.append({"key": key, "name": v["name"], "images": imgs, "items": its})
total = sum(len(a["items"]) for a in out)
assert len(out) == 20 and total == 66, (len(out), total)
js = json.dumps(out, ensure_ascii=False, indent=1)
ts = f'''// 바다 친구 20마리 · 이야기 66개 — 2026-11-23 대표님 전달("바다 친구 문안 20종 v1 — 결핍을 강점으로 쓰는 동물 이야기", 그림 zip "바다 친구 카드 그림(정사각) v1.1").
// 홈 첫 화면의 디저트 유형 그림·문구 대신 보여 준다(components/app/SeaFriendCard.tsx).
// images: 그 동물이 나오는 그림(혼자·함께) — public/sea-friends/<지문>.webp. 여러 친구가 함께 나오는 그림은 한 장만 두고 나오는 동물 모두의 목록에 들어 있어서,
//   그 그림이 뽑히면 그림 속 어느 동물의 이야기든 나올 수 있다(대표님 2026-11-23 "해달과 수달이 그림에 있으면 둘 다 뜰 수 있게").
// check: 문안 문서 3장 "게시 전 확인할 것"(화면에 쓰지 않음). 지금은 모두 보여 주고, 숨기려면 lib/seaFriends/pick.ts의 HIDE_UNCHECKED.
// 그림 zip이 새로 오면 scripts/sea_friends_build.py로 다시 만든다(손으로 고치지 않는다). 문안만 고칠 때는 이 파일을 고쳐도 된다.

export type SeaFriendItem = {{ id: string; title: string; body: string; check?: string }};
export type SeaFriend = {{ key: string; name: string; images: string[]; items: SeaFriendItem[] }};

export const SEA_FRIENDS: SeaFriend[] = {js};
'''
open(os.path.join(R, "lib", "seaFriends", "data.ts"), "w", encoding="utf-8").write(ts)
print("animals", len(out), "items", total, "unique images", len(seen), "refs", sum(len(a["images"]) for a in out))
