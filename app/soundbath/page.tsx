import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import SoundBath from "@/components/soundbath/SoundBath";

import { shareMetadata } from "@/lib/seo/share";

// 밖에 공유하면 "숲속 사운드배스" 배너(2026-11-27 대표님)
export const metadata = { title: "사운드 배스 | 쏠 웰니스 하우스", ...shareMetadata("soundbath") };

// 사운드 배스(2026-11-25, 요청문 v1.9.4 4·14-4장) — 마이페이지 "웰니스 상담 신청하기" 아래 배너로 들어온다. 하단 메뉴 없음.
export default function SoundBathPage() {
  return (
    <AccessGate>
      <AuthGate>
        <SoundBath />
      </AuthGate>
    </AccessGate>
  );
}
