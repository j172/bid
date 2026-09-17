// Shared vertical rhythm for the bottom-right floating action stack (LINE
// contact button + back-to-top button, issue #305), so the two independent
// components stay visually aligned without duplicating magic numbers.
//
// Each button is a 48px (h-12/w-12) circle 24px (bottom-6) off the viewport
// edge. The back-to-top button stacks 24px above the LINE button's top edge
// (24 + 48 + 24 = 96px, i.e. bottom-24).
//
// CookieConsentBanner (issue #121) occupies the same corner for first-time
// visitors, so both buttons lift further up while it's visible. Its height
// isn't fixed (the message wraps to more lines on narrow screens, and it
// switches from a stacked to a single-row layout at the `md` breakpoint —
// see CookieConsentBanner's own `md:flex-row`), so these are deliberately
// generous estimates rather than an exact measurement.
export const FLOATING_ACTION_BOTTOM = "bottom-6";
export const FLOATING_ACTION_BOTTOM_WITH_BANNER = "bottom-44 md:bottom-24";

export const FLOATING_ACTION_STACK_BOTTOM = "bottom-24";
export const FLOATING_ACTION_STACK_BOTTOM_WITH_BANNER = "bottom-[15.5rem] md:bottom-[10.5rem]";
