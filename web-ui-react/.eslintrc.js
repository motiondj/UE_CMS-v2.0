module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'no-console': 'off'
  },
  overrides: [
    {
      files: ['**/sw.js', '**/service-worker.js'],
      env: {
        serviceworker: true
      },
      rules: {
        'no-restricted-globals': 'off'
      }
    }
  ]
}; 