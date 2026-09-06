import { useTranslations } from "next-intl";

export const GOOGLE_PREFERENCE_HREF = "https://www.google.com/preferences/source?q=xiangshuicn.cc";

export default function GooglePreferenceButton({
  className = "",
}: {
  className?: string;
}) {
  const t = useTranslations("googlePreference");
  const tooltipText = t("tooltip");
  const buttonText = t("buttonText");

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <a
        href={GOOGLE_PREFERENCE_HREF}
        target="_blank"
        rel="noopener noreferrer"
        title={tooltipText}
        aria-label={buttonText}
        data-tooltip={tooltipText}
        className="gsButton group relative inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-interactive-primary/50 hover:bg-surface-subtle hover:text-interactive-primary active:scale-95 focus:outline-none focus:ring-2 focus:ring-interactive-primary/40 focus:ring-offset-1"
      >
        <svg
          className="gsBtnIcon h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            fill="#FFC107"
            d="M22.296 9.944h-.846V9.9H12v4.2h5.934A6.297 6.297 0 0 1 5.7 12 6.3 6.3 0 0 1 12 5.7c1.606 0 3.067.606 4.18 1.595l2.97-2.97A10.45 10.45 0 0 0 12 1.5C6.202 1.5 1.5 6.201 1.5 12S6.202 22.5 12 22.5c5.799 0 10.5-4.701 10.5-10.5 0-.704-.072-1.391-.204-2.056"
          />
          <path
            fill="#FF3D00"
            d="m2.71 7.113 3.45 2.53A6.3 6.3 0 0 1 12 5.7c1.606 0 3.067.606 4.18 1.595l2.97-2.97A10.45 10.45 0 0 0 12 1.5c-4.033 0-7.53 2.277-9.29 5.613"
          />
          <path
            fill="#4CAF50"
            d="M12 22.5c2.712 0 5.176-1.038 7.04-2.726l-3.25-2.75A6.25 6.25 0 0 1 12 18.3a6.3 6.3 0 0 1-5.924-4.172l-3.424 2.639C4.39 20.167 7.92 22.5 12 22.5"
          />
          <path
            fill="#1976D2"
            d="M22.296 9.9H12v4.2h5.934a6.3 6.3 0 0 1-2.146 2.925l.002-.001 3.25 2.75c-.23.209 3.46-2.524 3.46-7.774 0-.704-.072-1.435-.204-2.1"
          />
        </svg>
        <span className="gsBtnText whitespace-nowrap">{buttonText}</span>

        {/* Floating tooltip balloon on hover / focus */}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 mb-2 hidden w-60 rounded-lg bg-gray-900/95 px-3 py-1.5 text-center text-xs font-normal leading-relaxed text-white shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:block group-focus:block"
        >
          {tooltipText}
          <span className="absolute right-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 top-full border-4 border-transparent border-t-gray-900/95" />
        </span>
      </a>
    </div>
  );
}
