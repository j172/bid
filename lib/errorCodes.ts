// Stable error codes returned by public-facing domain functions and API
// routes, instead of literal Chinese text — the client translates the code
// via next-intl's "errors" message namespace for the visitor's current
// locale (see messages/*.json). Admin-only modules (lib/listingValidation.ts,
// lib/settlement.ts) are deliberately NOT part of this — the admin backend
// stays hardcoded Traditional Chinese (out of scope, admins are internal).
export type ErrorCode =
  | "NOT_FOUND"
  | "MUST_LOGIN"
  | "CANNOT_ACT_ON_OWN_LISTING"
  | "LISTING_NOT_OPEN"
  | "INVALID_BID_AMOUNT"
  | "BID_TOO_LOW"
  | "NO_BUY_IT_NOW_PRICE"
  | "INVALID_QUANTITY"
  | "INSUFFICIENT_STOCK"
  | "LISTING_NOT_FIXED_PRICE"
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_TOO_LONG"
  | "PHONE_REQUIRED"
  | "PHONE_INVALID_FORMAT"
  | "PHONE_INVALID_LENGTH"
  | "ADDRESS_REQUIRED"
  | "ADDRESS_TOO_LONG"
  | "EMAIL_INVALID"
  | "PASSWORD_TOO_SHORT"
  | "EMAIL_ALREADY_REGISTERED"
  | "EMAIL_OR_PASSWORD_INCORRECT"
  | "ACCOUNT_SUSPENDED"
  | "WRONG_OLD_PASSWORD"
  | "NEW_PASSWORD_TOO_SHORT"
  | "RESET_TOKEN_INVALID"
  | "EMAIL_OTP_INVALID"
  | "EMAIL_OTP_TOO_MANY_ATTEMPTS"
  | "EMAIL_OTP_RATE_LIMITED"
  | "WEBAUTHN_CHALLENGE_INVALID"
  | "WEBAUTHN_VERIFICATION_FAILED"
  | "LEADING_OPEN_LISTING"
  | "UNSETTLED_WIN"
  | "UNSETTLED_PURCHASE";
