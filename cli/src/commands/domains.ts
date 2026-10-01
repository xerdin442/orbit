import type { Command } from "commander";
import inquirer from "inquirer";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, warn, printTable } from "../lib/format.js";
import { fail, failWith } from "../lib/exit.js";

interface Domain {
  id: string;
  hostname: string;
  type: string;
  status: string;
}

interface DnsInstructions {
  recordType: "A" | "CNAME";
  host: string;
  value: string;
}

export function registerDomainCommands(program: Command) {
  const domains = program
    .command("domains")
    .description("Manage custom domains");

  domains
    .command("ls")
    .description("List domains")
    .action(async () => {
      const { ctx } = ensureContext();

      try {
        const result = await api.get<Domain[]>(
          `/environments/${ctx.environmentId}/domains`,
        );

        if (result.length === 0) {
          console.log("No domains configured.");
          return;
        }

        const headers = ["Hostname", "Type", "Status"];
        const rows = result.map((d) => [d.hostname, d.type, d.status]);

        printTable(headers, rows);
      } catch (err) {
        failWith(err, "Failed to list domains");
      }
    });

  domains
    .command("add <hostname>")
    .description("Add a custom domain")
    .action(async (hostname: string) => {
      const { ctx } = ensureContext();

      try {
        const dns = await api.post<DnsInstructions>(
          `/environments/${ctx.environmentId}/domains`,
          { hostname },
        );

        success(`Domain "${hostname}" added. Configure this DNS record:`);
        console.log(`  Type:  ${dns.recordType}`);
        console.log(`  Host:  ${dns.host}`);
        console.log(`  Value: ${dns.value}`);
        warn(
          "The record must not be proxied. If your DNS provider offers a proxy (e.g. Cloudflare's orange cloud), set it to DNS only.",
        );
      } catch (err) {
        failWith(err, "Failed to add domain");
      }
    });

  domains
    .command("rm <hostname>")
    .description("Remove a custom domain")
    .action(async (hostname: string) => {
      const { ctx } = ensureContext();

      try {
        const domains = await api.get<Domain[]>(
          `/environments/${ctx.environmentId}/domains`,
        );
        const domain = domains.find((d) => d.hostname === hostname);

        if (!domain) {
          fail(`Domain "${hostname}" not found in this environment.`);
        }

        if (domain.type !== "custom") {
          fail(
            `"${hostname}" is the environment's managed Orbit domain and can't be removed. Only custom domains added with \`orbit domains add\` can be removed.`,
          );
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: `Remove domain "${hostname}"?`,
            default: false,
          },
        ]);

        if (!confirm) return;

        await api.del(`/domains/${domain.id}`);
        success(`Domain "${hostname}" removed.`);
      } catch (err) {
        failWith(err, "Failed to remove domain");
      }
    });
}
