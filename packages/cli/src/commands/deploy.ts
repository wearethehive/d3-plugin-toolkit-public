import { Command } from 'commander'
import fsExtra from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'
import { findPluginWorkspace, findRepoRoot } from '../plugin-workspace.js'

const { copy, ensureDir, pathExists, readdir } = fsExtra

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    const srcPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      count += await countFiles(srcPath)
    } else {
      count++
    }
  }

  return count
}

async function copyDir(src: string, dest: string): Promise<number> {
  await ensureDir(dest)
  const count = await countFiles(src)
  await copy(src, dest, { overwrite: true })
  return count
}

export const deployCommand = new Command('deploy')
  .description('Copy built plugin to a Designer project')
  .argument('<plugin>', 'Plugin name (from packages/plugins/)')
  .requiredOption('--project <path>', 'Path to Designer project folder')
  .action(async (plugin: string, opts: { project: string }) => {
    const repoRoot = await findRepoRoot(process.cwd())
    const workspace = await findPluginWorkspace(repoRoot, plugin)

    if (!workspace) {
      console.error(chalk.red(`Plugin not found: ${plugin}`))
      process.exitCode = 1
      return
    }

    if (workspace.kind === 'remote') {
      console.error(chalk.red(`Cannot deploy remote plugin "${plugin}" to a project Plugins folder.`))
      console.error(chalk.gray(`Use: npm run cli -- remote dev ${plugin}`))
      process.exitCode = 1
      return
    }

    const distDir = join(workspace.dir, 'dist')

    if (!(await pathExists(distDir))) {
      console.error(chalk.red(`No dist/ found. Build first: npm -w packages/plugins/${plugin} run build`))
      process.exitCode = 1
      return
    }

    const targetDir = join(opts.project, 'Plugins', plugin)
    console.log(chalk.cyan(`Deploying ${plugin} -> ${targetDir}`))

    const count = await copyDir(distDir, targetDir)
    console.log(chalk.green(`Deployed ${count} files`))
    console.log(chalk.gray('Reload the plugin in Designer to see changes'))
  })
