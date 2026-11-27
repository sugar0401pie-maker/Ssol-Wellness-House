import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import WorryForm from "@/components/flow/WorryForm";

export default async function WorryPage({ params }: { params: Promise<{ type: string }> }) {
  const { slug, name } = await slugFrom(params);
  const c = uiCopy();
  const w = c.worry;
  return (
    <WorryForm
      slug={slug}
      copy={{
        title: w.title,
        sub: w.sub,
        hint: w.hint,
        min_len: w.min_len,
        max_len: w.max_len,
        too_short: w.too_short,
        button_submit: w.button_submit,
        button_skip: w.button_skip,
        footnote: w.footnote,
        rotate_seconds: w.rotate_seconds,
        short: c.tests[name].short,
        examples: w.examples?.[name]?.A ?? [],
      }}
    />
  );
}
