import {Command, flags} from '@oclif/command'
import * as Config from '@oclif/config'
import * as path from 'path'
import * as qq from 'qqjs'

import * as Tarballs from '../../tarballs'

export default class PackMacos extends Command {
  static description = 'pack CLI into MacOS .pkg'

  static flags = {
    root: flags.string({char: 'r', description: 'path to oclif CLI root', default: '.', required: true}),
  }

  async run() {
    if (process.platform !== 'darwin') throw new Error('must be run from macos')
    const {flags} = this.parse(PackMacos)
    const buildConfig = await Tarballs.buildConfig(flags.root)
    const {config} = buildConfig
    await Tarballs.build(buildConfig, {platform: 'darwin', pack: false})
    const dist = buildConfig.dist(`macos/${config.bin}.pkg`)
    await qq.emptyDir(path.dirname(dist))
    const scriptsDir = qq.join(buildConfig.tmp, 'macos/scripts')
    const writeScript = async (script: 'preinstall' | 'postinstall') => {
      const path = [scriptsDir, script]
      await qq.write(path, scripts[script](config))
      await qq.chmod(path, 0o755)
    }
    await writeScript('preinstall')
    await writeScript('postinstall')
    const c = config.pjson.oclif as any
    const args = [
      '--root', buildConfig.workspace({platform: 'darwin', arch: 'x64'}),
      '--identifier', c.macos.identifier,
      '--version', config.version,
      '--install-location', `/usr/local/lib/${config.dirname}`,
      '--sign', c.macos.sign,
      '--scripts', scriptsDir,
    ]
    if (process.env.OSX_KEYCHAIN) args.push('--keychain', process.env.OSX_KEYCHAIN)
    args.push(dist)
    await qq.x('pkgbuild', args)
  }
}

const scripts = {
  preinstall: (config: Config.IConfig) => `#!/usr/bin/env bash
sudo rm -rf /usr/local/lib/${config.bin}
sudo rm -rf /usr/local/${config.bin}
sudo rm -rf /usr/local/bin/${config.bin}
`,
  postinstall: (config: Config.IConfig) => `#!/usr/bin/env bash
set -x
sudo mkdir -p /usr/local/bin
sudo ln -sf /usr/local/lib/${config.dirname}/bin/${config.dirname} /usr/local/bin/${config.dirname}
`,
}