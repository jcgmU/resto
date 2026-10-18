/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  globalTeardown: '<rootDir>/test/globalTeardown.ts',
};
