import type { Metadata } from "next";
import LegalPage, { legalPageMetadata } from "../components/legalPage";

const NAMESPACE = "privacyPage";
const PATHNAME = "/privacy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalPageMetadata(NAMESPACE, PATHNAME, locale);
}

export default async function PrivacyPage() {
  return <LegalPage namespace={NAMESPACE} />;
}
