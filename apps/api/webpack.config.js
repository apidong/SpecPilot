// NestJS webpack config — resolves .js imports to .ts source files
// Required because the source uses ESM-style .js extensions with commonjs module

module.exports = (options, webpack) => {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      extensionAlias: {
        '.js': ['.ts', '.js'],
      },
    },
  };
};
