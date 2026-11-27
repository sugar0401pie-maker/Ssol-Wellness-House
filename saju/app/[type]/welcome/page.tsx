import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import WelcomeForm from "@/components/flow/WelcomeForm";

export default async function WelcomePage({ params }: { params: Promise<{ type: string }> }) {
  const { slug } = await slugFrom(params);
  const c = uiCopy();
  return <WelcomeForm slug={slug} copy={{ ...c.welcome, ask: c.sal_intro.ask }} />;
}
