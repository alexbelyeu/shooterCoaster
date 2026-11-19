// The templates' project only (tsconfig.json here). The game meets R3F's JSX elements through its imports;
// the templates' own closure doesn't, so they are referenced here.
/// <reference types="@react-three/fiber" />

/** The templates' one token in code position: `npm run new-world` writes the world's seed in its place. */
declare const __SEED__: number
