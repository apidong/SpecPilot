/**
 * Custom Jest resolver to handle .js extension imports resolving to .ts files
 * (TypeScript ESM pattern: import from './module.js' → resolves to ./module.ts)
 */
const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  // For relative .js imports, check if a .ts counterpart exists on disk
  if (request.match(/^\.{1,2}\//) && request.endsWith('.js')) {
    const tsAbsPath = path.resolve(options.basedir, request.slice(0, -3) + '.ts');
    if (fs.existsSync(tsAbsPath)) {
      return tsAbsPath;
    }
    const tsxAbsPath = path.resolve(options.basedir, request.slice(0, -3) + '.tsx');
    if (fs.existsSync(tsxAbsPath)) {
      return tsxAbsPath;
    }
  }
  return options.defaultResolver(request, options);
};
