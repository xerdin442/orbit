#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLinkCommand } from "./commands/link.js";
import { registerDeployCommand } from "./commands/deploy.js";
import { registerLogsCommand } from "./commands/logs.js";
import { registerListCommand } from "./commands/list.js";
import { registerEnvCommands } from "./commands/env.js";
import { registerDomainCommands } from "./commands/domains.js";
import {
  registerInfoCommand,
  registerRedeployCommand,
  registerRollbackCommand,
} from "./commands/info.js";
import { setApiUrl } from "./lib/config.js";

const program = new Command();

program
  .name("orbit")
  .description("Deploy apps on Orbit — your self-hosted PaaS")
  .version("1.0.0")
  .option("--api-url <url>", "Orbit API URL", process.env.ORBIT_API_URL);

program.hook("preAction", async (thisCommand) => {
  const opts = thisCommand.optsWithGlobals() as { apiUrl?: string };
  if (opts.apiUrl) {
    setApiUrl(opts.apiUrl);
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

program.parse();
