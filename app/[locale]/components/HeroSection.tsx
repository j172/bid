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
    <section className="bg-gradient-to-b from-[#eef4ff] via-[#f3f6fb] to-[#f7f8fb]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-7 text-white shadow-xl lg:col-span-2 lg:min-h-[420px]">
            <span className="absolute right-4 top-4 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
              Up to 40% Off
            </span>
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/20 blur-2xl" />

            <div className="max-w-lg">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">{badge}</p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">{title}</h1>
              <p className="mt-4 text-base text-blue-100 sm:text-lg">{subtitle}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={browseHref} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-blue-50">
                  {browseLabel}
                </Link>
                <Link href={auctionHref} className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
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

            <div className="mt-10 grid max-w-md grid-cols-3 gap-2 text-xs text-blue-100 sm:text-sm">
              <p className="rounded-md bg-white/15 px-3 py-2 text-center backdrop-blur-sm">{primary?.subtitle ?? ""}</p>
              <p className="rounded-md bg-white/15 px-3 py-2 text-center backdrop-blur-sm">即時競標</p>
              <p className="rounded-md bg-white/15 px-3 py-2 text-center backdrop-blur-sm">安全交易</p>
            </div>
          </article>

          <div className="grid gap-4">
            {[promoA, promoB].filter(Boolean).map((item, index) => (
              <Link
                key={item!.id}
                href={`/listings/${item!.id}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`pointer-events-none absolute inset-0 opacity-80 ${
                    index === 0
                      ? "bg-gradient-to-br from-cyan-50 via-white to-blue-50"
                      : "bg-gradient-to-br from-amber-50 via-white to-rose-50"
                  }`}
                />
                <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-blue">{index === 0 ? "SPECIAL EDITION" : "LIMITED EDITION"}</p>
                <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight text-ink">{item!.title}</h2>
                <p className="mt-2 text-sm text-ink-light">{item!.subtitle}</p>
                <p className="mt-4 inline-flex items-center text-sm font-semibold text-header">Shop Now →</p>

                {item!.photo && (
                  <div className="mt-4 h-28 overflow-hidden rounded-xl bg-slate-100">
                    <ProgressiveImage
                      src={listingPhotoUrl(item!.id, item!.photo)}
                      alt={item!.title}
                      eager={false}
                      fetchPriority="auto"
                      sizes="(max-width: 1024px) 100vw, 22vw"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}