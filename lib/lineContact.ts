// Customer-service LINE add-friend link (issue #305, broken link fixed in
// #355). #335 previously replaced a broken `line.me/ti/p/~ID` personal-ID
// deep link with a copy-phone-number flow, believing LINE had no public
// add-friend URL scheme. The user has since supplied a valid LINE official
// account "ticket URL" (a different, genuinely working mechanism), so the
// direct link is restored. Shared between LineContactButton (the site-wide
// floating button) and FooterLineContact (SiteFooter's "help & support"
// section's LINE row) so both link to the same destination.
export const LINE_CONTACT_HREF = "https://line.me/ti/p/jV0-8xU-6b";

// Call-for-price seller contact phone number (issue #339). Independent of
// the LINE add-friend link above — this is the direct-dial number shown on
// call-for-price listings/products so buyers can ring the seller directly.
// Same real-world number the LINE flow used before #355 replaced it with
// the direct LINE link, kept as its own constant since the two features are
// unrelated and #355 no longer exposes a phone-number constant to derive
// from.
const CALL_FOR_PRICE_PHONE = "0909256829";
export const CALL_FOR_PRICE_PHONE_DISPLAY = `${CALL_FOR_PRICE_PHONE.slice(0, 4)}-${CALL_FOR_PRICE_PHONE.slice(4, 7)}-${CALL_FOR_PRICE_PHONE.slice(7)}`;
export const CALL_FOR_PRICE_PHONE_HREF = `tel:${CALL_FOR_PRICE_PHONE}`;
