// Builds the exact ProductCard props (badge/price/detail lines) for one
// listing row — extracted from app/[locale]/listings/(with-loading)/page.tsx
// (issue #314) so the loft storefront grid on /listings?loft=<id> and the
// new /featured-lofts/[id] article page (which embeds that same loft's
// current listings below the article body) render identical cards from one
// source of truth instead of two copies of this branching logic drifting
// apart.
import type { ListingCardExtras, ListingType, ListingWithPhotos } from "@/lib/listings";
import { formatDualPrice, formatNtd, type CurrencyRate } from "@/lib/currency";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";

// Same shape as lib/format.ts's private Translator type — next-intl's
// useTranslations/getTranslations both return a callable matching this.
type Translator = (key: string, values?: Record<string, string | number>) => string;

export const LISTING_DESCRIPTION_SNIPPET_LENGTH = 30;

// Plain-text card excerpt (the listing's HTML description isn't rendered on
// the grid card, just a short snippet — unlike the detail page's full
// RichTextContent render).
export function listingDescriptionSnippet(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > LISTING_DESCRIPTION_SNIPPET_LENGTH
    ? `${trimmed.slice(0, LISTING_DESCRIPTION_SNIPPET_LENGTH)}…`
    : trimmed;
}

export interface ListingCardView {
  id: number;
  title: string;
  description: string;
  photo?: string;
  typeBadgeLabel: string;
  loftName: string | null;
  quickActionLabel: string;
  viewDetailsLabel: string;
  isClosed: boolean;
  priceText: string;
  detailLines: string[];
}

export interface BuildListingCardViewOptions {
  /** "listings" namespace translator — same keys the /listings grid card uses. */
  t: Translator;
  /** "format" namespace translator, passed straight through to formatRemaining. */
  tFormat: Translator;
  currencyRates: CurrencyRate[];
  anonymousBuyer: string;
}

const TYPE_BADGE_LABEL_KEY: Record<ListingType, string> = {
  auction: "badgeAuction",
  fixed_price: "badgeFixedPrice",
};

export function buildListingCardView(
  listing: ListingWithPhotos & ListingCardExtras,
  { t, tFormat, currencyRates, anonymousBuyer }: BuildListingCardViewOptions,
): ListingCardView {
  const isClosed = listing.status === "closed";

  const priceText =
    isClosed && listing.listing_type === "auction"
      ? t("finalPrice", { price: formatNtd(listing.current_price) })
      : listing.listing_type === "fixed_price" && listing.price === null
        ? t("callForPrice")
        : formatDualPrice(
            listing.listing_type === "fixed_price" ? listing.price! : listing.current_price,
            currencyRates,
          );

  const detailLines = isClosed
    ? listing.listing_type === "fixed_price"
      ? [t("soldOut"), t("totalPurchases", { count: listing.purchaseCount })]
      : [
          listing.ends_at ? formatRemaining(listing.ends_at, tFormat) : t("statusEnded"),
          listing.bidCount === 0
            ? t("noBidsEnded")
            : t("finalLeader", { name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer) }),
          t("totalBids", { count: listing.bidCount }),
        ]
    : listing.listing_type === "fixed_price"
      ? [
          listing.stock_remaining === 0
            ? t("soldOut")
            : t("remainingUnits", { count: listing.stock_remaining ?? 0 }),
          t("totalPurchases", { count: listing.purchaseCount }),
        ]
      : listing.status === "scheduled" && listing.starts_at
        ? [
            formatRemaining(listing.starts_at, tFormat, {
              prefixKey: "startsInPrefix",
              endedKey: "startingSoon",
            }),
          ]
        : [
            ...(listing.buy_it_now_price !== null
              ? [t("buyItNowPrice", { price: formatNtd(listing.buy_it_now_price) })]
              : []),
            listing.ends_at ? formatRemaining(listing.ends_at, tFormat) : t("timeless"),
            listing.bidCount === 0
              ? t("noBidsYet")
              : t("currentLeader", { name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer) }),
            t("totalBids", { count: listing.bidCount }),
          ];

  return {
    id: listing.id,
    title: listing.title,
    description: listingDescriptionSnippet(listing.description),
    photo: listing.photos[0],
    typeBadgeLabel: isClosed ? t("badgeClosed") : t(TYPE_BADGE_LABEL_KEY[listing.listing_type]),
    loftName: listing.loftName,
    quickActionLabel: isClosed ? t("viewDetails") : t("quickAction"),
    viewDetailsLabel: t("viewDetails"),
    isClosed,
    priceText,
    detailLines,
  };
}
