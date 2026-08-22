export default {
  '*.{js,jsx,ts,tsx}': ['bun lint --fix', 'oxfmt --disable-nested-config'],
  '*.{json,yaml,yml,md}': ['oxfmt --write --disable-nested-config'],
}
