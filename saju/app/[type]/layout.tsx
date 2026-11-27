import { slugFrom } from "@/lib/route";

// 테스트별 화면 묶음(/love · /career · /money · /total). 다른 이름이면 404.
export default async function TestLayout({ children, params }: { children: React.ReactNode; params: Promise<{ type: string }> }) {
  await slugFrom(params);
  return children;
}
