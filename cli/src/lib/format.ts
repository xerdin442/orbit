import chalk from "chalk";

const STATUS_COLORS: Record<string, typeof chalk.red> = {
  ready: chalk.green,
  failed: chalk.red,
  aborted: chalk.yellow,
  deploying: chalk.cyan,
  building: chalk.cyan,
  cloning: chalk.cyan,
  pending: chalk.gray,
};

export function statusBadge(status: string): string {
  const color = STATUS_COLORS[status] ?? chalk.gray;
  return color(`[${status}]`);
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function formatDuration(start: Date, end?: Date | null): string {
  const ms = (end ?? new Date()).getTime() - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function formatTimestamp(date: Date | string): string {
  return new Date(date).toLocaleString();
}

export function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce(
      (max, row) => Math.max(max, (row[i] ?? "").length),
      0,
    );
    return Math.max(h.length, maxData);
  });

  const headerLine = headers
    .map((h, i) => chalk.bold(h.padEnd(colWidths[i]!)))
    .join("  ");

  console.log(headerLine);

  for (const row of rows) {
    const line = row
      .map((cell, i) => (cell ?? "").padEnd(colWidths[i]!))
      .join("  ");
    console.log(line);
  }
}

export function success(msg: string): void {
  console.log(chalk.green(`✔ ${msg}`));
}

export function error(msg: string): void {
  console.error(chalk.red(`✖ ${msg}`));
}

export function warn(msg: string): void {
  console.warn(chalk.yellow(`⚠ ${msg}`));
}

export function info(msg: string): void {
  console.log(chalk.blue(`${msg}`));
}
