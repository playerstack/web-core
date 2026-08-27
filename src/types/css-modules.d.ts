/**
 * Ambient module declaration so TypeScript treats `*.css` default imports as a plain
 * string. The Style_Layer CSS (`playerstack.css`) is imported for its text content and
 * fed to a constructable `CSSStyleSheet` via Style_Auto_Injection (Req 3.7, 3.8). The
 * build (esbuild `text` loader) and Jest (a css transform) both resolve the import to
 * the file's text; this declaration keeps `tsc` in agreement with that runtime shape.
 */
declare module '*.css' {
  const content: string;
  export default content;
}
