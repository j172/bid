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
  return (
    <section className="bg-header text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="inline-flex rounded-full bg-brand-blue/20 px-3 py-1 text-xs font-semibold text-blue-100">{badge}</p>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">{subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={browseHref} className="rounded-md bg-gold px-6 py-3 font-semibold text-white hover:bg-gold-dark">
              {browseLabel}
            </Link>
            <Link href={auctionHref} className="rounded-md border border-slate-500 px-6 py-3 font-semibold text-white hover:border-slate-200">
              {auctionLabel}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {cards.map((item, index) => (
            <Link
              key={item.id}
              href={`/listings/${item.id}`}
              className="group overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80 p-3"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
                {item.photo && (
                  <ProgressiveImage
                    src={listingPhotoUrl(item.id, item.photo)}
                    alt={item.title}
                    eager={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    sizes="(max-width: 1024px) 50vw, 24vw"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}