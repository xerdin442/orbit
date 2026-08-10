import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";

interface ResourceTableDataProps {
  columns: { name: string }[];
  rows: Record<string, unknown>[];
  isLoading?: boolean;
  emptyMessage?: string;
  pagination?: {
    totalCount: number;
    pageSize: number;
    pageIndex: number;
    onPageChange: (page: number) => void;
  };
}

export function ResourceTableData({
  columns,
  rows,
  isLoading,
  emptyMessage = "No rows to see here.",
  pagination,
}: ResourceTableDataProps) {
  const tableColumns: ColumnDef<Record<string, unknown>>[] = columns.map(
    (col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">
          {row.original[col.name] === null ||
          row.original[col.name] === undefined
            ? "—"
            : String(row.original[col.name])}
        </span>
      ),
    }),
  );

  return (
    <DataTable
      columns={tableColumns}
      data={rows}
      isLoading={isLoading}
      totalCount={pagination?.totalCount ?? rows.length}
      pageSize={pagination?.pageSize ?? Math.max(rows.length, 1)}
      pageIndex={pagination?.pageIndex ?? 0}
      onPageChange={pagination?.onPageChange}
      emptyMessage={emptyMessage}
      stickyHeader
    />
  );
}
