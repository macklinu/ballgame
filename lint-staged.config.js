const withoutVendoredSources = (files) =>
  files.filter((file) => !/(^|[/\\])vendor([/\\]|$)/.test(file))

const commandsForApplicationFiles = (commands) => (files) => {
  const applicationFiles = withoutVendoredSources(files)

  if (applicationFiles.length === 0) {
    return []
  }

  const quotedFiles = applicationFiles.map((file) => JSON.stringify(file)).join(' ')

  return commands.map((command) => `${command} ${quotedFiles}`)
}

export default {
  '*.{js,jsx,ts,tsx}': commandsForApplicationFiles([
    'nub run lint --fix',
    'oxfmt --disable-nested-config',
  ]),
  '*.{json,yaml,yml,md}': commandsForApplicationFiles(['oxfmt --write --disable-nested-config']),
}
