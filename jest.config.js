module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  collectCoverageFrom: ['rate-limiter/src/**/*.ts', '!rate-limiter/src/main.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
