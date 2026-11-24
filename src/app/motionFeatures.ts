// framer-motion's animation features (#861): the `m` elements' animate / exit / variants and hover / tap gestures,
// a lazy chunk `LazyMotion` (App.tsx) loads at mount, so they stay out of the startup JS.
export { domAnimation as default } from 'framer-motion'
