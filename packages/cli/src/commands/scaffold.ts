import { Command } from 'commander'
import fsExtra from 'fs-extra'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const { ensureDir, pathExists, readdir, readFile, writeFile } = fsExtra

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '../../../../templates/plugin')

/** Walk up from cwd until we find the repo root (has packages/cli and packages/shared). */
async function findRepoRoot(from: string): Promise<string> {
  let dir = from
  while (true) {
    if (
      await pathExists(join(dir, 'packages', 'cli')) &&
      await pathExists(join(dir, 'packages', 'shared'))
    ) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error('Could not find repo root (no packages/cli + packages/shared ancestor)')
    dir = parent
  }
}

interface TemplateVars {
  pluginName: string
  title: string
  description: string
  width: string
  height: string
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
}

export const scaffoldCommand = new Command('scaffold')
  .description('Create a new plugin from template')
  .argument('<name>', 'Plugin name (kebab-case, e.g., my-plugin)')
  .option('--title <title>', 'Plugin display title')
  .option('--description <desc>', 'Plugin description', 'A Disguise Designer plugin')
  .option('--width <n>', 'Plugin window width', '800')
  .option('--height <n>', 'Plugin window height', '600')
  .action(async (name: string, opts: { title?: string; description: string; width: string; height: string }) => {
    const repoRoot = await findRepoRoot(process.cwd())
    const pluginsDir = join(repoRoot, 'packages', 'plugins')
    const targetDir = join(pluginsDir, name)

    if (await pathExists(targetDir)) {
      console.error(chalk.red(`Plugin already exists: ${targetDir}`))
      return
    }

    const title = opts.title || name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    const vars: TemplateVars = {
      pluginName: name,
      title,
      description: opts.description,
      width: opts.width,
      height: opts.height,
    }

    console.log(chalk.cyan(`Scaffolding plugin: ${name}`))
    await copyDir(TEMPLATE_DIR, targetDir, vars)

    console.log(chalk.green(`Created plugin at packages/plugins/${name}/`))
    console.log()
    console.log(chalk.gray('Next steps:'))
    console.log(chalk.white('  npm install'))
    console.log(chalk.white(`  npm -w packages/plugins/${name} run dev`))
    console.log(chalk.white(`  npm -w packages/plugins/${name} run build`))
  })
