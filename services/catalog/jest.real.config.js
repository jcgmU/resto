/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['<rootDir>/test-real/**/*.test.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: false,
};
