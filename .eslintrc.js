module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Possible Errors
    'no-console': 'off', // Allow console for CLI tool
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // Best Practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    'curly': ['error', 'all'],
    
    // Stylistic
    'indent': ['error', 2],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
    
    // ES6
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-template': 'error',
    'arrow-spacing': 'error'
  }
};