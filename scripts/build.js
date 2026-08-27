const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const srcRoot = path.resolve(__dirname, '../src');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

/**
 * Derive entry points from package.json "exports" field.
 * Each subpath export maps to a source file in src/.
 *
 * The "require" path tells us the output location (dist/cjs/<path>.js),
 * from which we infer the source file (src/<path>.ts or src/<path>/index.ts).
 */
function getEntryPoints() {
  const entries = {};

  for (const [subpath, conditions] of Object.entries(pkg.exports)) {
    // Some exports (e.g. "./styles/css") point directly at a static asset via a
    // string value rather than a conditions object. CSS asset subpaths are copied
    // by copyCssAssets, not bundled as entry points — skip anything that isn't a
    // JS export with a `require` condition.
    if (typeof conditions === 'string' || !conditions.require) {
      continue;
    }

    // Use the CJS output path to derive the source entry
    const cjsOut = conditions.require;

    // A `.css` require target is a static asset, not a bundleable JS entry point;
    // copyCssAssets is responsible for placing it in dist.
    if (cjsOut.endsWith('.css')) {
      continue;
    }

    // Strip "dist/cjs/" prefix and ".js" suffix to get the relative src path
    const relPath = cjsOut.replace('./dist/cjs/', '').replace('.js', '');

    // Find the actual source file
    const extensions = ['.ts', '.tsx'];
    let srcFile = null;

    for (const ext of extensions) {
      const candidate = path.resolve(srcRoot, relPath + ext);
      if (fs.existsSync(candidate)) {
        srcFile = candidate;
        break;
      }
    }

    // Try as directory with index
    if (!srcFile) {
      for (const ext of extensions) {
        const candidate = path.resolve(srcRoot, relPath, 'index' + ext);
        if (fs.existsSync(candidate)) {
          srcFile = candidate;
          break;
        }
      }
    }

    if (!srcFile) {
      console.warn(`Warning: no source file found for export "${subpath}" (expected src/${relPath})`);
      continue;
    }

    // Use the relative output path (without extension) as the entry key
    // so esbuild writes to the correct location in outdir
    entries[relPath] = srcFile;
  }

  return entries;
}

/**
 * Esbuild plugin: resolve @alias imports to absolute paths in src/.
 * Only works with bundle:true (which is what we use).
 */
function aliasPlugin() {
  return {
    name: 'alias-resolve',
    setup(build) {
      build.onResolve({ filter: /^@/ }, (args) => {
        // Skip npm scoped packages
        if (args.path.startsWith('@playerstack/')) return null;
        let stripped = args.path.slice(1);

        // Map @typings/ to types/ directory
        if (stripped.startsWith('typings/')) {
          stripped = 'types/' + stripped.slice('typings/'.length);
        }

        const candidate = path.resolve(srcRoot, stripped);
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];

        // Try exact file
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { path: candidate };
        }
        // Try with extensions
        for (const ext of extensions) {
          if (fs.existsSync(candidate + ext)) {
            return { path: candidate + ext };
          }
        }
        // Try as directory with index
        for (const ext of extensions) {
          const indexPath = path.join(candidate, 'index' + ext);
          if (fs.existsSync(indexPath)) {
            return { path: indexPath };
          }
        }

        // Not our alias — let esbuild handle
        return null;
      });
    },
  };
}

/**
 * Copy static CSS assets from src into dist so they can be published and imported
 * directly by consumers (Req 11.3: the player stylesheet is exposed as an importable
 * asset via the "./styles/css" export). The CSS is authored by hand in src and is not
 * produced by esbuild, so it must be copied verbatim into dist/styles/.
 */
function copyCssAssets() {
  const cssSrc = path.resolve(srcRoot, 'styles/playerstack.css');
  const cssDestDir = path.resolve(__dirname, '../dist/styles');
  const cssDest = path.join(cssDestDir, 'playerstack.css');

  fs.mkdirSync(cssDestDir, { recursive: true });
  fs.copyFileSync(cssSrc, cssDest);

  console.log('copied CSS asset -> dist/styles/playerstack.css');
}

/**
 * Build the self-contained standalone bundle from src/vanilla.ts (Req 6.1, 6.3).
 *
 * Unlike the ESM/CJS builds (which keep dependencies external for tree-shaking by a
 * downstream bundler), the standalone bundle is meant to be dropped into a plain
 * `<script>` tag with no build step — so it must inline every dependency (e.g.
 * load-script). That's why `packages: 'external'` is intentionally omitted here.
 * The IIFE is exposed under the global `Playerstack` (Req 6.3).
 */
async function buildStandalone() {
  const esbuild = require('esbuild');

  await esbuild.build({
    // The entryPoints key sets the output filename: dist/standalone/playerstack.standalone.js
    entryPoints: { 'playerstack.standalone': path.resolve(srcRoot, 'vanilla.ts') },
    outdir: 'dist/standalone',
    format: 'iife',
    globalName: 'Playerstack',
    platform: 'browser',
    target: 'es2020',
    bundle: true,
    sourcemap: true,
    plugins: [aliasPlugin()],
    // Import `*.css` as a text string so the Style_Layer can be fed to a CSSStyleSheet.
    loader: { '.css': 'text' },
  });

  console.log('standalone bundle done');
}

async function build() {
  const esbuild = require('esbuild');
  const entryPoints = getEntryPoints();
  const entryCount = Object.keys(entryPoints).length;

  console.log(`Building ${entryCount} entry points (bundle mode)...`);

  // ESM — with splitting to share code between entry points
  await esbuild.build({
    entryPoints,
    outdir: 'dist/esm',
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    bundle: true,
    splitting: true,
    sourcemap: true,
    packages: 'external',
    plugins: [aliasPlugin()],
    // Import `*.css` as a text string so the Style_Layer can be fed to a CSSStyleSheet.
    loader: { '.css': 'text' },
    outExtension: { '.js': '.js' },
  });

  // CJS — no splitting (not supported), build each entry separately
  // to avoid inlining shared code into every file
  for (const [outPath, srcFile] of Object.entries(entryPoints)) {
    await esbuild.build({
      entryPoints: { [outPath]: srcFile },
      outdir: 'dist/cjs',
      format: 'cjs',
      platform: 'browser',
      target: 'es2020',
      bundle: true,
      sourcemap: true,
      packages: 'external',
      plugins: [aliasPlugin()],
      // Import `*.css` as a text string so the Style_Layer can be fed to a CSSStyleSheet.
      loader: { '.css': 'text' },
      outExtension: { '.js': '.js' },
    });
  }

  console.log('esbuild done');

  // Self-contained IIFE bundle for zero-build `<script>` usage (Req 6.1, 6.3).
  await buildStandalone();

  // Copy the hand-authored stylesheet into dist as an importable asset (Req 11.3).
  copyCssAssets();

  // Types
  execSync('npx tsc --emitDeclarationOnly --outDir dist/types', { stdio: 'inherit' });
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
