import { redirect } from "next/navigation";

// /onboarding → 첫 질문
export default function Onboarding() {
  redirect("/onboarding/1");
}
