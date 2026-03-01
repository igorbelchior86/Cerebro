export default {
  displayName: '@cerebro/api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '<rootDir>/src/index.ts'
  ],
  moduleNameMapper: {
    '^@cerebro/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 30000,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'ES2020',
          lib: ['ES2020'],
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true
        }
      }
    ]
  }
};
