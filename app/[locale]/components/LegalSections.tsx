// Renders the numbered prose sections of a legal page (issue #121). The
// sections live in messages/*.json as an array of objects rather than a flat
// run of sectionNTitle/sectionNBody keys, so each locale's document can have
// its own paragraph/bullet shape and stays readable to edit — they're read
// out with next-intl's t.raw(), which hands back the raw message value
// instead of running it through ICU formatting.
export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Trailing paragraph rendered after `bullets` (e.g. "to exercise these
   * rights, contact us ..." following a bulleted list of rights). */
  footnote?: string;
}

export default function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section, index) => (
        <section key={section.title} className={index === 0 ? undefined : "mt-8"}>
          <h2 className="text-lg font-bold text-ink">{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-7 text-ink-light">
              {paragraph}
            </p>
          ))}
          {section.bullets && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-light">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
          {section.footnote && <p className="mt-3 text-sm leading-7 text-ink-light">{section.footnote}</p>}
        </section>
      ))}
    </>
  );
}
