import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Excludes the admin backend (/z04urru6/**, out of scope — stays
  // hardcoded Traditional Chinese, unprefixed), API routes (return JSON,
  // not pages), the uploaded-photo file server, Next's internals, and any
  // path with a file extension (static assets).
  matcher: ["/((?!api|z04urru6|uploads|_next|.*\\..*).*)"],
};
