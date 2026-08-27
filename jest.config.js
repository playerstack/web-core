module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.ts', '!src/types.ts', '!src/types/**', '!src/index.ts', '!src/utils/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'json', 'clover', 'text'],
  coveragePathIgnorePatterns: ['node_modules', 'dist'],
  reporters: ['default', ['jest-junit', { outputDirectory: 'coverage', outputName: 'report.xml' }]],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'css'],
  // Preserve the ts-jest transform (the preset default) and add a `.css` -> text
  // transform so Style_Layer CSS imports resolve to their raw text (see cssTransform.js).
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
    '\\.css$': '<rootDir>/test/__transforms__/cssTransform.js',
  },
  resolver: '<rootDir>/jest.resolver.js',
};
