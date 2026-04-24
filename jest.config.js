module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.e2e-spec.ts'],
  // Docker integration tests require live containers and hit the same
  // Postgres the e2e suite uses — keep them out of the default run.
  // Invoke them explicitly with `yarn test:docker`.
  testPathIgnorePatterns: ['/node_modules/', '/tests/docker/'],
  verbose: true,
  collectCoverageFrom: ['rate-limiter/src/**/*.ts', '!rate-limiter/src/main.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
