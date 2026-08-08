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
};

module.exports = withNextIntl(nextConfig);
