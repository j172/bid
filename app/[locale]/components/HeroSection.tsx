import { Link } from "@/i18n/navigation";
import ProgressiveImage from "@/app/components/ProgressiveImage";
import { listingPhotoUrl } from "@/lib/uploads";

interface HeroCardItem {
  id: number;
  title: string;
  subtitle: string;
  photo?: string;
}

interface HeroSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  browseLabel: string;
  auctionLabel: string;
  browseHref: string;
  auctionHref: string;
  cards: HeroCardItem[];
}

export default function HeroSection({
  badge,
  title,
  subtitle,
  browseLabel,
  auctionLabel,
  browseHref,
  auctionHref,
  cards,
}: HeroSectionProps) {
  const [primary, promoA, promoB] = cards;

  return (
    <section className="bg-[#f3f5f8]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="relative isolate overflow-hidden rounded-2xl bg-white p-7 shadow-sm lg:col-span-2 lg:min-h-[420px]">
            <div className="max-w-lg">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-blue">{badge}</p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-ink sm:text-5xl">{title}</h1>
              <p className="mt-4 text-base text-ink-light sm:text-lg">{subtitle}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={browseHref} className="rounded-md bg-header px-6 py-3 text-sm font-semibold text-white hover:bg-header-soft">
                  {browseLabel}
                </Link>
                <Link href={auctionHref} className="rounded-md border border-border px-6 py-3 text-sm font-semibold text-ink hover:border-brand-blue hover:text-brand-blue">
                  {auctionLabel}
                </Link>
              </div>
            </div>

            {primary?.photo && (
              <div className="pointer-events-none absolute -bottom-6 right-0 w-[45%] min-w-[230px] max-w-[360px] px-4">
                <ProgressiveImage
                  src={listingPhotoUrl(primary.id, primary.photo)}
                  alt={primary.title}
                  eager
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 0vw, 30vw"
                  className="h-auto w-full object-contain drop-shadow-2xl"
                />
              </div>
            )}

            <div className="mt-10 grid max-w-md grid-cols-3 gap-2 text-xs text-ink-light sm:text-sm">
              <p className="rounded-md bg-slate-100 px-3 py-2 text-center">{primary?.subtitle ?? ""}</p>
              <p className="rounded-md bg-slate-100 px-3 py-2 text-center">即時競標</p>
              <p className="rounded-md bg-slate-100 px-3 py-2 text-center">安全交易</p>
            </div>
          </article>

          <div className="grid gap-4">
            {[promoA, promoB].filter(Boolean).map((item, index) => (
              <Link
                key={item!.id}
                href={`/listings/${item!.id}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue">{index === 0 ? "SPECIAL EDITION" : "LIMITED EDITION"}</p>
                <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight text-ink">{item!.title}</h2>
                <p className="mt-2 text-sm text-ink-light">{item!.subtitle}</p>
                <p className="mt-4 inline-flex items-center text-sm font-semibold text-header">Shop Now →</p>

                {item!.photo && (
                  <div className="mt-4 h-28 overflow-hidden rounded-xl bg-slate-100">
                    <ProgressiveImage
                      src={listingPhotoUrl(item!.id, item!.photo)}
                      alt={item!.title}
                      eager={index === 0}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      sizes="(max-width: 1024px) 100vw, 22vw"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}