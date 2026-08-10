const withNextIntl = require("next-intl/plugin")();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @node-rs/jieba (issue #105) ships a native binary loaded via a
  // non-ESM-placeable asset — Turbopack's production bundler can't inline
  // it into a route's JS chunk ("asset is not placeable in ESM chunks").
  // It's only ever used server-side (lib/search.ts, imported by
  // lib/listings.ts), so excluding it from bundling and letting Next.js
  // require() it directly from node_modules at runtime is the documented
  // fix for native addons like this.
  serverExternalPackages: ["@node-rs/jieba"],

  // Baseline security response headers (issue #140 M-3). Applied to every
  // route; .remote-index.php sets the same set on the responses it serves
  // itself (static assets, proxy errors) and re-asserts them on proxied ones,
  // so the two entry points can't disagree.
  //
  // Deliberately NOT a full Content-Security-Policy: this app renders
  // TinyMCE (inline styles, and its own dynamically-injected style/script
  // handling) plus Next.js's own inline bootstrap/flight scripts, so any
  // meaningful script-src/style-src would need nonce plumbing through every
  // rendering path and would silently break pages if a single case were
  // missed. `frame-ancestors 'self'` is the one directive that carries real
  // value with zero rendering risk — it is the modern, non-deprecated
  // clickjacking control, and unlike X-Frame-Options it is honoured by
  // browsers that have dropped the older header. A fuller CSP is left as
  // separate, individually-verifiable work.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: the login/account pages must never be framed by a
          // third-party site. Both headers are sent because coverage differs
          // by browser (see the comment above).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          // Stops a browser from second-guessing a declared Content-Type —
          // relevant for app/uploads/[...path], which serves visitor-uploaded
          // files, and for any response that falls back to
          // application/octet-stream.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URL to same-origin, origin only cross-origin: keeps listing
          // ids / reset-token query strings out of third-party referrer logs.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 2 years, subdomains included. Browsers ignore this over plain
          // HTTP, so local `next dev` is unaffected; production is
          // HTTPS-only behind Cloudflare.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
