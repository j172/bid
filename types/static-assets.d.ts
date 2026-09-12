// Ambient module declarations for directly importing static image files as
// ES modules (e.g. `import icon from "leaflet/dist/images/marker-icon.png"`
// in app/[locale]/pigeon-stations/PigeonStationsMap.tsx).
//
// Next.js normally supplies these via next-env.d.ts, which references
// node_modules/next/image-types/global.d.ts — but next-env.d.ts is
// gitignored (see .gitignore) and is only (re)generated as a side effect of
// running `next dev` or `next build`. This project's `npm run typecheck`
// runs bare `tsc --noEmit` as its own CI step, *before* `npm run build`
// (see .github/workflows/deploy-ftps.yml) — so on a fresh checkout/CI
// runner that hasn't run next dev/build yet, next-env.d.ts doesn't exist,
// the wildcard `declare module '*.png'` isn't in scope, and `tsc` fails
// with TS2307 "Cannot find module" on any direct image import. Declaring
// the same module shapes here (committed to the repo, not gitignored)
// makes typecheck succeed regardless of whether next-env.d.ts has been
// generated yet. Mirrors node_modules/next/image-types/global.d.ts's own
// declarations so behavior matches what Next.js's bundler actually produces
// at build time.
declare module "*.png" {
  const src: { src: string; width: number; height: number; blurDataURL?: string; blurWidth?: number; blurHeight?: number };
  export default src;
}

declare module "*.jpg" {
  const src: { src: string; width: number; height: number; blurDataURL?: string; blurWidth?: number; blurHeight?: number };
  export default src;
}

declare module "*.jpeg" {
  const src: { src: string; width: number; height: number; blurDataURL?: string; blurWidth?: number; blurHeight?: number };
  export default src;
}

declare module "*.gif" {
  const src: { src: string; width: number; height: number; blurDataURL?: string; blurWidth?: number; blurHeight?: number };
  export default src;
}

declare module "*.webp" {
  const src: { src: string; width: number; height: number; blurDataURL?: string; blurWidth?: number; blurHeight?: number };
  export default src;
}

declare module "*.svg" {
  // Matches next/image-types/global.d.ts's own `any` here — avoids
  // conflicting with @svgr/webpack-style SVG-as-component imports should
  // this project ever add one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any;
  export default content;
}
