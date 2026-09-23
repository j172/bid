// Customer-service LINE add-friend link (issue #305, broken link fixed in
// #355). #335 previously replaced a broken `line.me/ti/p/~ID` personal-ID
// deep link with a copy-phone-number flow, believing LINE had no public
// add-friend URL scheme. The user has since supplied a valid LINE official
// account "ticket URL" (a different, genuinely working mechanism), so the
// direct link is restored. Shared between LineContactButton (the site-wide
// floating button) and FooterLineContact (SiteFooter's "help & support"
// section's LINE row) so both link to the same destination.
export const LINE_CONTACT_HREF = "https://line.me/ti/p/jV0-8xU-6b";
