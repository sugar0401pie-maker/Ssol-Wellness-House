import { Md } from "./Md";
import ReviewRotator from "./ReviewRotator";

// 결제 전 유료 쪽. 이 파일의 컴포넌트는 공개 문구(ui_copy)와 가상 예시만 받는다 — 이용자 결과 값을 props로 넘기지 않는다.

export type PayBoxProps = {
  title: string; // paywall.title 또는 title_decision(채운 값)
  lead: string; // paywall.price_lead(채운 값)
  reviews: string[];
  button: string;
  href: string; // /checkout/{id}?page={N}
};

export function PayBox({ title, lead, reviews, button, href }: PayBoxProps) {
  return (
    <div className="paybox">
      <div className="pt">
        <Md text={title} />
      </div>
      <p className="lead">
        <Md text={lead} />
      </p>
      <ReviewRotator lines={reviews} />
      <a className="btn gold" href={href}>
        {button}
      </a>
    </div>
  );
}

/** 쪽 예고 문장 + 흐린 가상 예시(ui_copy.blur). */
export function BlurTeaser({ teaser, sample }: { teaser: string; sample: string }) {
  return (
    <>
      {teaser && (
        <p>
          <Md text={teaser} />
        </p>
      )}
      {sample && (
        <div className="lockwrap" aria-hidden="true">
          <div className="blurred">
            <Md text={sample} />
          </div>
        </div>
      )}
    </>
  );
}
