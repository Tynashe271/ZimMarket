// sharp@0.35's package.json splits types into dist/index.d.mts (ESM) and
// dist/index.d.cts (CJS) via conditional "exports", which this project's
// classic (non-node16) moduleResolution can't follow -- it always resolves
// to the ESM types regardless of how the module is imported at runtime.
// Node's own `require()` still loads the correct dist/index.cjs at runtime;
// this shim only covers the narrow surface this codebase actually calls.
declare module 'sharp' {
  interface SharpInstance {
    rotate(): SharpInstance;
    resize(options: { width?: number; height?: number; fit?: 'inside' | 'outside' | 'cover' | 'contain' | 'fill'; withoutEnlargement?: boolean }): SharpInstance;
    jpeg(options?: { quality?: number; mozjpeg?: boolean }): SharpInstance;
    png(options?: { quality?: number; compressionLevel?: number }): SharpInstance;
    webp(options?: { quality?: number }): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }
  interface SharpCreateOptions {
    create: { width: number; height: number; channels: number; background: { r: number; g: number; b: number } };
  }
  function sharp(input?: Buffer | SharpCreateOptions): SharpInstance;
  export = sharp;
}
