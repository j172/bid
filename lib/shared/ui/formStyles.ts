// Single source of truth for the public site's text-input Tailwind classes
// (issue #139 item 2) — this exact string used to be copy-pasted as a local
// `const inputClass` in ten separate form components (account/*, contact,
// login, register, forgot-password, reset-password), so a change to the
// focus ring or border had to be made ten times to stay consistent.
//
// Deliberately a plain constant rather than a wrapper <Input> component: the
// call sites all need their own native input attributes (type, pattern,
// maxLength, inputMode, autoFocus, ...) and some compose it with extra
// classes (ContactForm's textarea adds `min-h-28`), which a wrapper would
// only get in the way of.
export const inputClass =
  "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";
