module.exports = {
  packagerConfig: {
    ignore: [
      /^\/src/,
      /(.eslintrc.json)|(.gitignore)|(electron.vite.config.ts)|(forge.config.cjs)|(tsconfig.*)/,
      /node_modules\/onnxruntime-node\/bin\/napi-v3\/darwin/,
      /node_modules\/onnxruntime-node\/bin\/napi-v3\/linux/
    ],
    icon: 'resources/icon'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: 'https://getflowtake.com/images/favicon/logo-lg.ico',
        setupIcon: './resources/setup.ico',
        signWithParams: `/sha1 "${process.env.CERT_THUMBPRINT}" /tr http://time.certum.pl /td sha256 /fd sha256 /v`,
        loadingGif: './resources/loading.gif'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Jnx03',
          name: 'flowtake'
        },
        prerelease: false
      }
    }
  ]
}
