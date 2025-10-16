export default {
  '*.{js,jsx,ts,tsx}': ['oxlint --fix', 'prettier --write'],
  '*.{json,yaml,yml,md}': ['prettier --write'],
}
