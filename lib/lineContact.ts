// Customer-service LINE contact phone number (issue #305, corrected in
// #335). LINE does not offer a public "add friend by phone number" URL
// scheme — the `line.me/ti/p/~ID` deep-link format only works for a LINE
// personal ID, not a phone number, so it can't be used here. Instead we
// show/copy this number and ask visitors to search for it inside the LINE
// app themselves (which also requires the account to allow being found by
// phone number). Shared between LineContactButton (the site-wide floating
// button) and SiteFooter (the "help & support" section's LINE row) so both
// display and copy the same number.
export const LINE_CONTACT_PHONE = "0909256829";
