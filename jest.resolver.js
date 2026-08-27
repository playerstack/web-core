const path = require('path');
const fs = require('fs');

const srcDir = path.resolve(__dirname, 'src');

/**
 * Custom Jest resolver that handles @alias imports.
 * Resolves @foo/bar to src/foo/bar (with extension resolution).
 * Falls back to default resolution for npm scoped packages.
 */
module.exports = (request, options) => {
  if (request.startsWith('@') && !request.startsWith('@playerstack/')) {
    const stripped = request.slice(1);

    // Map @typings/ to types/ directory
    const mappedPath = stripped.startsWith('typings/') ? 'types/' + stripped.slice('typings/'.length) : stripped;

    const candidate = path.resolve(srcDir, mappedPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    // Try exact file
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    // Try with extensions
    for (const ext of extensions) {
      if (fs.existsSync(candidate + ext)) {
        return candidate + ext;
      }
    }
    // Try as directory with index
    for (const ext of extensions) {
      const indexPath = path.join(candidate, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
    // Not a local alias — fall through to default resolution
  }

  return options.defaultResolver(request, options);
};
