import type { Metadata } from "next";
import PublicBoardShell from "@/components/board/PublicBoardShell";
import BoardView from "@/components/board/BoardView";
import { loadEpisodes, loadGuides, upcomingEpisodes } from "@/lib/board/fetchSite";
import { SHARE_IMAGE } from "@/lib/seo/paths";

// 고민 타파 공개 게시판(2026-11-25 대표님 요청) — 로그인 없이 볼 수 있고 검색엔진·AI가 읽을 수 있게 서버가 글자로 내려보낸다.
// 앱 안 고민 타파(/worry)와 같은 화면(BoardView)이고, 글자 구름은 "많이 찾는 순" 점수로 보인다. 30분마다 새로 만든다.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "고민 타파 | 쏠 웰니스 하우스",
  description: "재회, 썸, 이직, 퇴사, 카톡 답장… 많이 찾는 고민을 한눈에 보고, 먼저 한 줄로 정리한 생각거리와 고민우체국 연재를 읽어 보세요.",
  alternates: { canonical: "/board" },
  openGraph: { title: "고민 타파 | 쏠 웰니스 하우스", description: "많이 찾는 고민과 고민우체국 연재", images: [SHARE_IMAGE] },
};

export default async function PublicBoard() {
  const [guides, episodes] = await Promise.all([loadGuides(), loadEpisodes()]);
  return (
    <PublicBoardShell>
      <div className="px-5 pt-5">
        <h1 className="text-[22px] font-bold">고민 타파</h1>
        {(guides.stale || episodes.stale) && <p className="mt-1 text-[12px] text-night-yellow">지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.</p>}
      </div>
      <BoardView guides={guides.data} episodes={episodes.data} upcoming={upcomingEpisodes()} basis="none" basePath="/board" />
      <div className="h-6" />
    </PublicBoardShell>
  );
}
