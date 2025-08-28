module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ]
};