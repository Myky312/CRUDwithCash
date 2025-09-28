// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    // disable the rule globally
    '@typescript-eslint/consistent-type-imports': 'off',
  },
})
