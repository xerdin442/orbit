import type { Command } from "commander";
import inquirer from "inquirer";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, error, printTable } from "../lib/format.js";

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
      const ctx = ensureContext();

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
        error(err instanceof Error ? err.message : "Failed to list domains");
        process.exit(1);
      }
    });

  domains
    .command("add <hostname>")
    .description("Add a custom domain")
    .action(async (hostname: string) => {
      const ctx = ensureContext();

      try {
        const dns = await api.post<DnsInstructions>(
          `/environments/${ctx.environmentId}/domains`,
          { hostname },
        );

        success(
          `Domain "${hostname}" added. Configure this DNS record in your provider:`,
        );
        console.log(`  Type:  ${dns.recordType}`);
        console.log(`  Host:  ${dns.host}`);
        console.log(`  Value: ${dns.value}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to add domain");
        process.exit(1);
      }
    });

  domains
    .command("rm <hostname>")
    .description("Remove a custom domain")
    .action(async (hostname: string) => {
      const ctx = ensureContext();

      try {
        const all = await api.get<Domain[]>(
          `/environments/${ctx.environmentId}/domains`,
        );
        const domain = all.find(
          (d) => d.hostname === hostname && d.type === "custom",
        );

        if (!domain) {
          error(`Custom domain "${hostname}" not found.`);
          process.exit(1);
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
        error(err instanceof Error ? err.message : "Failed to remove domain");
        process.exit(1);
      }
    });
}
