import chalk from "chalk";
import { stripVTControlCharacters } from "node:util";

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

function visibleWidth(text: string): number {
  return stripVTControlCharacters(text).length;
}

function padVisible(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

export function formatTable(headers: string[], rows: string[][]): string[] {
  const colWidths = headers.map((h, i) =>
    rows.reduce(
      (max, row) => Math.max(max, visibleWidth(row[i] ?? "")),
      visibleWidth(h),
    ),
  );

  const lastCol = headers.length - 1;
  const formatRow = (cells: string[], style = (s: string) => s) =>
    cells
      .map((cell, i) =>
        style(i === lastCol ? cell : padVisible(cell, colWidths[i]!)),
      )
      .join("  ");

  return [
    formatRow(headers, chalk.bold),
    ...rows.map((row) => formatRow(headers.map((_, i) => row[i] ?? ""))),
  ];
}

export function printTable(headers: string[], rows: string[][]): void {
  for (const line of formatTable(headers, rows)) {
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
