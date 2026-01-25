/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '!**/__tests__/helpers/**'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000, // 10 seconds per test
};
