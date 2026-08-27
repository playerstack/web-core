/**
 * Jest transform that turns a `*.css` import into its text content as a CommonJS default
 * export. ts-jest does not transform `.css`, so this mirrors the esbuild `text` loader:
 * `import css from '@styles/playerstack.css'` resolves to the file's raw text at runtime
 * (used by the Style_Auto_Injection to build a CSSStyleSheet).
 */
module.exports = {
  process(src) {
    return { code: 'module.exports = ' + JSON.stringify(src) + ';' };
  },
};
