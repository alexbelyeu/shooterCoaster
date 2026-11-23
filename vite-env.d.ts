/// <reference types="vite/client" />

/** True when Vercel ran the build (`VERCEL=1`); set by `define` in vite.config.ts. */
declare const __BUILT_ON_VERCEL__: boolean

/** True in `vite build --mode portal` (`npm run build:portal`): no Share on the results screen (#254). */
declare const __PORTAL_BUILD__: boolean

/** package.json version, + the short commit on Vercel builds; set by `define` in vite.config.ts. */
declare const __APP_VERSION__: string
