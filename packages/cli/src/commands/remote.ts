import { spawn } from 'child_process'
import { Command } from 'commander'
import chalk from 'chalk'
import { relative } from 'path'
import { findPluginWorkspace, findRepoRoot } from '../plugin-workspace.js'

function run(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => resolve(code ?? 0))
  })
}

async function runRemoteScript(plugin: string, script: string, extraArgs: string[] = []): Promise<void> {
  const repoRoot = await findRepoRoot(process.cwd())
  const workspace = await findPluginWorkspace(repoRoot, plugin)

  if (!workspace) {
    console.error(chalk.red(`Remote plugin not found: ${plugin}`))
    process.exitCode = 1
    return
  }

  if (workspace.kind !== 'remote') {
    console.error(chalk.red(`Plugin "${plugin}" is local. Remote commands only run against packages/remote-plugins/.`))
    process.exitCode = 1
    return
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const workspacePath = relative(repoRoot, workspace.dir).replace(/\\/g, '/')
  const args = ['-w', workspacePath, 'run', script]
  if (extraArgs.length > 0) args.push('--', ...extraArgs)

  const code = await run(npmCmd, args, repoRoot)
  if (code !== 0) process.exitCode = code
}

export const remoteCommand = new Command('remote')
  .description('Develop and package remote Designer plugins')

remoteCommand
  .command('dev')
  .description('Start a remote plugin dev server and publisher')
  .argument('<plugin>', 'Remote plugin name')
  .action((plugin: string) => runRemoteScript(plugin, 'dev'))

remoteCommand
  .command('build')
  .description('Build a remote plugin frontend')
  .argument('<plugin>', 'Remote plugin name')
  .action((plugin: string) => runRemoteScript(plugin, 'build'))

remoteCommand
  .command('smoke')
  .description('Run remote plugin smoke checks')
  .argument('<plugin>', 'Remote plugin name')
  .option('--server', 'Also check the running backend health endpoint')
  .option('--designer', 'Also check backend connectivity to Designer')
  .option('--dnssd', 'Also check DNS-SD discovery for the running publisher')
  .action((plugin: string, opts: { server?: boolean; designer?: boolean; dnssd?: boolean }) => {
    const extraArgs = []
    if (opts.server) extraArgs.push('--server')
    if (opts.designer) extraArgs.push('--designer')
    if (opts.dnssd) extraArgs.push('--dnssd')
    return runRemoteScript(plugin, 'smoke', extraArgs)
  })

remoteCommand
  .command('package')
  .description('Create a Windows-first remote plugin distributable folder')
  .argument('<plugin>', 'Remote plugin name')
  .action((plugin: string) => runRemoteScript(plugin, 'package'))
