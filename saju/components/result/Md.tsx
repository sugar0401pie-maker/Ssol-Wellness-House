import { Fragment } from "react";
import { splitBold } from "@/lib/resultView";

/** 아주 작은 글 그리기: **굵게** → <b>, 줄바꿈(\n) → <br>. HTML은 해석하지 않는다(이용자가 쓴 고민이 들어올 수 있음). */
export function Md({ text }: { text: string | null | undefined }) {
  const lines = String(text ?? "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {splitBold(line).map((s, j) => (s.bold ? <b key={j}>{s.text}</b> : <Fragment key={j}>{s.text}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}

/** 여러 줄을 <br>로 잇는다. */
export function MdLines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Md text={l} />
        </Fragment>
      ))}
    </>
  );
}
