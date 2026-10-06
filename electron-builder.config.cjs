module.exports = {
  appId: 'com.rls.simulator',
  productName: 'Тренажёр оператора РЛС',
  directories: { output: 'release' },
  files: ['desktop/main.cjs', 'server/dist-desktop/index.cjs', 'package.json'],
  extraResources: [
    { from: 'client/dist', to: 'client-dist' },
    { from: 'THIRD_PARTY_NOTICES.txt', to: 'THIRD_PARTY_NOTICES.txt' },
  ],
  extraMetadata: { main: 'desktop/main.cjs' },
  asar: true,
  asarUnpack: ['server/dist-desktop/index.cjs'],
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  publish: null,
};
