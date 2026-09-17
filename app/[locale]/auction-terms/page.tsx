import type { Metadata } from "next";
import LegalPage, { legalPageMetadata } from "../components/legalPage";

const NAMESPACE = "auctionTermsPage";
const PATHNAME = "/auction-terms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalPageMetadata(NAMESPACE, PATHNAME, locale);
}

export default async function AuctionTermsPage() {
  return <LegalPage namespace={NAMESPACE} />;
}
