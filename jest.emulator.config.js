// Firebase Emulator integration tests run in plain Node (real fetch, Node
// builds of the Firebase SDK), unlike the jest-expo unit tests.
// Usage: see src/sync/__tests__/firebase.emulator.test.ts
// babel-preset-expo ships inside the expo package.
const babelPresetExpo = require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] });

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.emulator.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: [babelPresetExpo] }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
