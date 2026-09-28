#!/usr/bin/env node
import { Command } from "commander";
import {
  registerAuthCommands,
  registerInitCommand,
  registerLinkCommand,
  registerDeployCommand,
  registerLogsCommand,
  registerListCommand,
  registerEnvCommands,
  registerDomainCommands,
  registerInfoCommand,
  registerRedeployCommand,
  registerRollbackCommand,
  registerAbortCommand,
} from "./commands/index.js";
import { createRequire } from "node:module";
import { getApiUrl, setApiUrl } from "./lib/config.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

// Commands that only touch local config and work without an API URL
const OFFLINE_COMMANDS = new Set(["auth logout", "auth reset"]);

const program = new Command();

program
  .name("orbit")
  .description("Deploy apps on Orbit — your self-hosted PaaS")
  .version(version)
  .option(
    "--api-url <url>",
    "Orbit API URL (saved for later commands; ORBIT_API_URL overrides it)",
  );

program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals() as { apiUrl?: string };
  if (opts.apiUrl) {
    setApiUrl(opts.apiUrl);
  }

  const parent = actionCommand.parent;
  const fullName =
    parent && parent !== program
      ? `${parent.name()} ${actionCommand.name()}`
      : actionCommand.name();

  // Display setup instructions if there is no default server
  if (!OFFLINE_COMMANDS.has(fullName)) {
    getApiUrl();
  }
});

registerAuthCommands(program);
registerInitCommand(program);
registerLinkCommand(program);
registerDeployCommand(program);
registerLogsCommand(program);
registerListCommand(program);
registerEnvCommands(program);
registerDomainCommands(program);
registerInfoCommand(program);
registerRedeployCommand(program);
registerRollbackCommand(program);
registerAbortCommand(program);

program.parse();
