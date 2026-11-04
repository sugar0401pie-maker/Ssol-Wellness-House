# -*- coding: utf-8 -*-
# 파비콘(브라우저 탭 아이콘) 생성 — 가로로 긴 물결 로고(public/logo-mark.png, 440x117)를 정사각형 아이콘으로 만든다. 로고 자체는 바꾸지 않고 크기만 맞춘다.
#   python3 scripts/make_favicon.py            ← app/icon.png · app/apple-icon.png · app/favicon.ico 를 다시 만든다(Pillow 필요)
# 바탕은 앱 배경색(아이보리)이다: 네이비 로고가 어두운 탭 배경에서도 보이게 하려는 것이다.
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IVORY = (247, 243, 236, 255)  # --background #f7f3ec
mark = Image.open(os.path.join(ROOT, "public", "logo-mark.png")).convert("RGBA")


def tile(size, mark_w, radius, rounded=True):
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0) if rounded else IVORY)
    if rounded:
        ImageDraw.Draw(bg).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=IVORY)
    h = round(mark.height * mark_w / mark.width)
    bg.alpha_composite(mark.resize((mark_w, h), Image.LANCZOS), ((size - mark_w) // 2, (size - h) // 2))
    return bg


big = tile(512, 432, 112)  # 메인 아이콘(둥근 모서리)
big.save(os.path.join(ROOT, "app", "icon.png"))
tile(180, 150, 0, rounded=False).convert("RGB").save(os.path.join(ROOT, "app", "apple-icon.png"))  # iOS는 자체 모서리를 씌우므로 꽉 찬 정사각형
big.save(os.path.join(ROOT, "app", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("ok")
