import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import ReportDetailPage from "@/components/app/ReportDetailPage";

export const metadata = { title: "테스트 결과 | 쏠 웰니스 하우스" };

export default async function Report({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  return (
    <AccessGate>
      <AuthGate>
        <ReportDetailPage resultId={resultId} />
      </AuthGate>
    </AccessGate>
  );
}
