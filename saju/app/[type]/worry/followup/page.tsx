import { slugFrom } from "@/lib/route";
import FollowupForm from "@/components/flow/FollowupForm";

// 다시 묻기 — 자기 주소가 있는 화면(질문 내용은 서버가 고민 글로 정해 브라우저에 넘겨 둔 것)
export default async function FollowupPage({ params }: { params: Promise<{ type: string }> }) {
  const { slug } = await slugFrom(params);
  return <FollowupForm slug={slug} />;
}
