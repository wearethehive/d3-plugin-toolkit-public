#!/usr/bin/env node
import { Command } from 'commander'
import { execCommand } from './commands/exec.js'
import { testCommand } from './commands/test.js'
import { probeCommand } from './commands/probe.js'
import { testSuiteCommand } from './commands/test-suite.js'
import { scaffoldCommand } from './commands/scaffold.js'
import { deployCommand } from './commands/deploy.js'
import { learnCommand } from './commands/learn.js'
import { discoverCommand } from './commands/discover.js'
import { sessionCommand } from './commands/session.js'
import { kbCommand } from './commands/kb.js'
import { remoteCommand } from './commands/remote.js'

const program = new Command()
  .name('d3')
  .description('Disguise Designer plugin development toolkit')
  .version('0.1.0')

program.addCommand(execCommand)
program.addCommand(testCommand)
program.addCommand(probeCommand)
program.addCommand(testSuiteCommand)
program.addCommand(scaffoldCommand)
program.addCommand(deployCommand)
program.addCommand(learnCommand)
program.addCommand(discoverCommand)
program.addCommand(sessionCommand)
program.addCommand(kbCommand)
program.addCommand(remoteCommand)

program.parse()
