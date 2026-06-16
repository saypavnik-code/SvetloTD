/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { strict: false, esModuleInterop: true, module: 'commonjs' },
    }],
  },
  moduleNameMapper: {
    '^phaser$': '<rootDir>/src/__tests__/__mocks__/phaser.ts',
  },
  moduleDirectories: ['node_modules', '<rootDir>/src'],
};
