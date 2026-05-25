import { Command } from 'commander'
import fsExtra from 'fs-extra'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import {
  findRepoRoot,
  pluginDirForKind,
  validatePluginKind,
  validateRemoteBackend,
  type PluginKind,
  type RemoteBackend,
} from '../plugin-workspace.js'

const { ensureDir, pathExists, readdir, readFile, writeFile } = fsExtra

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCAL_TEMPLATE_DIR = join(__dirname, '../../../../templates/plugin')
const REMOTE_PYTHON_TEMPLATE_DIR = join(__dirname, '../../../../templates/remote-plugin-python')
const REMOTE_NODE_TEMPLATE_DIR = join(__dirname, '../../../../templates/remote-plugin-node')

interface TemplateVars {
  pluginName: string
  title: string
  description: string
  width: string
  height: string
  backend: string
}

async function copyDir(src: string, dest: string, vars: TemplateVars): Promise<void> {
  await ensureDir(dest)
  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    let destName = entry.name

    if (destName.endsWith('.tmpl')) {
      destName = destName.slice(0, -5)
    }

    const destPath = join(dest, destName)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, vars)
    } else {
      const content = await readFile(srcPath, 'utf-8')
      const processed = replaceVars(content, vars)
      await writeFile(destPath, processed, 'utf-8')
    }
  }
}

function replaceVars(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{\{pluginName\}\}/g, vars.pluginName)
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{description\}\}/g, vars.description)
    .replace(/\{\{width\}\}/g, vars.width)
    .replace(/\{\{height\}\}/g, vars.height)
    .replace(/\{\{backend\}\}/g, vars.backend)
}

function templateDirFor(kind: PluginKind, backend: RemoteBackend): string {
  if (kind === 'local') return LOCAL_TEMPLATE_DIR
  return backend === 'node' ? REMOTE_NODE_TEMPLATE_DIR : REMOTE_PYTHON_TEMPLATE_DIR
}

export const scaffoldCommand = new Command('scaffold')
  .description('Create a new plugin from template')
  .argument('<name>', 'Plugin name (kebab-case, e.g., my-plugin)')
  .option('--type <type>', 'Plugin type: local or remote', 'local')
  .option('--backend <backend>', 'Remote backend: python or node', 'python')
  .option('--title <title>', 'Plugin display title')
  .option('--description <desc>', 'Plugin description', 'A Disguise Designer plugin')
  .option('--width <n>', 'Plugin window width', '800')
  .option('--height <n>', 'Plugin window height', '600')
  .action(async (name: string, opts: { type: string; backend: string; title?: string; description: string; width: string; height: string }) => {
    const repoRoot = await findRepoRoot(process.cwd())
    const kind = validatePluginKind(opts.type)
    const backend = validateRemoteBackend(opts.backend)
    const targetDir = pluginDirForKind(repoRoot, name, kind)

    if (await pathExists(targetDir)) {
      console.error(chalk.red(`Plugin already exists: ${targetDir}`))
      return
    }

    const title = opts.title || name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const templateDir = templateDirFor(kind, backend)

    if (!(await pathExists(templateDir))) {
      console.error(chalk.red(`Template not found: ${templateDir}`))
      return
    }

    const vars: TemplateVars = {
      pluginName: name,
      title,
      description: opts.description,
      width: opts.width,
      height: opts.height,
      backend,
    }

    console.log(chalk.cyan(`Scaffolding ${kind} plugin: ${name}`))
    await copyDir(templateDir, targetDir, vars)

    const workspacePath = kind === 'remote' ? `packages/remote-plugins/${name}/` : `packages/plugins/${name}/`
    console.log(chalk.green(`Created plugin at ${workspacePath}`))
    console.log()
    console.log(chalk.gray('Next steps:'))
    console.log(chalk.white('  npm install'))
    if (kind === 'remote') {
      console.log(chalk.white(`  npm run cli -- remote dev ${name}`))
      console.log(chalk.white(`  npm run cli -- remote smoke ${name}`))
      console.log(chalk.white(`  npm run cli -- remote package ${name}`))
    } else {
      console.log(chalk.white(`  npm -w packages/plugins/${name} run dev`))
      console.log(chalk.white(`  npm -w packages/plugins/${name} run build`))
    }
  })
