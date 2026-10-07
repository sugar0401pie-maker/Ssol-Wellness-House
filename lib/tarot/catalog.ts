// 쏠 타로 하우스(별도 저장소 sugar0401pie-maker/ssol-tarot, tarot.ssolwellnesshouse.com)의 카드·분류 이름표.
// 원본은 그 저장소의 data/tarot_data.json(v2.2). 여기에는 마이페이지·채팅에서 이름을 보여 주는 데 필요한 값만 옮겼다
// (카드 해석·실천 같은 유료 문장은 옮기지 않음). 타로 쪽 카드 이름이 바뀌면 이 파일도 같이 바꾼다.

export const TAROT_ORIGIN = "https://tarot.ssolwellnesshouse.com";

export const TAROT_CARDS: Record<string, { no: number; name: string; character: string; image: string }> = {
  "splash": {
    "no": 0,
    "name": "첫 물장구",
    "character": "수달",
    "image": "card-00-splash.webp"
  },
  "eight_hands": {
    "no": 1,
    "name": "여덟 갈래의 손",
    "character": "문어",
    "image": "card-01-eight_hands.webp"
  },
  "still_watch": {
    "no": 2,
    "name": "고요히 바라보기",
    "character": "왜가리",
    "image": "card-02-still_watch.webp"
  },
  "embrace": {
    "no": 3,
    "name": "품어 주는 품",
    "character": "해달",
    "image": "card-03-embrace.webp"
  },
  "guard_place": {
    "no": 4,
    "name": "지키는 자리",
    "character": "펭귄",
    "image": "card-04-guard_place.webp"
  },
  "old_wisdom": {
    "no": 5,
    "name": "오래된 지혜",
    "character": "거북",
    "image": "card-05-old_wisdom.webp"
  },
  "swim_together": {
    "no": 6,
    "name": "나란히 헤엄",
    "character": "원앙",
    "image": "card-06-swim_together.webp"
  },
  "ride_wave": {
    "no": 7,
    "name": "파도를 타는 힘",
    "character": "돌고래",
    "image": "card-07-ride_wave.webp"
  },
  "pearl": {
    "no": 8,
    "name": "진주를 품는 힘",
    "character": "조개",
    "image": "card-08-pearl.webp"
  },
  "lantern": {
    "no": 9,
    "name": "나만의 등불",
    "character": "바다의 노인",
    "image": "card-09-lantern.webp"
  },
  "current_cycle": {
    "no": 10,
    "name": "물살의 순환",
    "character": "가오리",
    "image": "card-10-current_cycle.webp"
  },
  "balance": {
    "no": 11,
    "name": "고요한 균형",
    "character": "백조",
    "image": "card-11-balance.webp"
  },
  "rock_rest": {
    "no": 12,
    "name": "바위 위의 쉼",
    "character": "물범",
    "image": "card-12-rock_rest.webp"
  },
  "new_shell": {
    "no": 13,
    "name": "새 집으로 이사",
    "character": "소라게",
    "image": "card-13-new_shell.webp"
  },
  "between": {
    "no": 14,
    "name": "물과 뭍 사이",
    "character": "개구리",
    "image": "card-14-between.webp"
  },
  "puffed": {
    "no": 15,
    "name": "부풀어 오른 마음",
    "character": "복어",
    "image": "card-15-puffed.webp"
  },
  "rebuild_dam": {
    "no": 16,
    "name": "다시 쌓는 둑",
    "character": "비버",
    "image": "card-16-rebuild_dam.webp"
  },
  "star_again": {
    "no": 17,
    "name": "다시 빛나는 별",
    "character": "불가사리",
    "image": "card-17-star_again.webp"
  },
  "moon_drift": {
    "no": 18,
    "name": "달빛 아래 떠다니기",
    "character": "해파리",
    "image": "card-18-moon_drift.webp"
  },
  "sun_rock": {
    "no": 19,
    "name": "햇살 바위",
    "character": "물개",
    "image": "card-19-sun_rock.webp"
  },
  "answer_call": {
    "no": 20,
    "name": "부름에 답하다",
    "character": "혹등고래",
    "image": "card-20-answer_call.webp"
  },
  "whole_sea": {
    "no": 21,
    "name": "한 바퀴의 바다",
    "character": "쏠 바다 친구들 모두",
    "image": "card-21-whole_sea.webp"
  }
};

export const TAROT_POSITIONS: Record<string, string> = {
  "now": "지금의 마음",
  "hold": "나를 붙잡는 것",
  "step": "다음 한 걸음"
};

export const TAROT_DOMAINS: Record<string, string> = {
  "CAR": "직업·커리어",
  "DIR": "진로·자기계발",
  "LOV": "연애",
  "FAM": "가족",
  "SOC": "교우·사회관계",
  "LIF": "재정·생활안정"
};

export const TAROT_EMOTIONS: Record<string, string> = {
  "ANX": "불안",
  "TIR": "지침",
  "LON": "외로움",
  "HUR": "서운함",
  "CON": "막막함",
  "SHA": "자책",
  "GRI": "슬픔",
  "HOP": "설렘"
};

export const TAROT_NEEDS: Record<string, string> = {
  "REST": "쉼",
  "START": "시작할 용기",
  "CHOOSE": "정리와 선택",
  "CONNECT": "연결",
  "BOUNDARY": "나를 지키는 선",
  "LETGO": "놓아주기와 회복"
};
