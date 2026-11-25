import { notFound } from "next/navigation";
import OnboardingPage from "@/components/app/OnboardingPage";
import { QUESTIONS } from "@/lib/onboarding/schema";
import { onboardingStepFrom } from "@/lib/onboarding/stepPath";

export const metadata = { title: "나에 대해 알려주기 | 쏠 웰니스 하우스" };

// 온보딩 질문 화면: /onboarding/1 ~ 9 · 동의 /onboarding/agree (대표님 2026-11-25 — 화면마다 주소)
export default async function Step({ params }: { params: Promise<{ step: string }> }) {
  const step = onboardingStepFrom((await params).step, QUESTIONS.length);
  if (step == null) notFound();
  return <OnboardingPage step={step} />;
}
