export default {
  '*.{js,jsx,ts,tsx}': ['bun lint --fix', 'oxfmt'],
  '*.{json,yaml,yml,md}': ['oxfmt --write'],
}
