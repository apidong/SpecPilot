module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  resolver: '<rootDir>/../jest.resolver.js',
  moduleNameMapper: {
    '^@specpilot/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
};
