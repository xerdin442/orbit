import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/shared/skeleton";
import { ErrorState } from "@/components/shared/error-state";

interface NonRelationalTableDataProps {
  rows: Record<string, unknown>[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  pagination?: {
    totalCount: number;
    pageSize: number;
    pageIndex: number;
    onPageChange: (page: number) => void;
  };
  bounded?: boolean;
}

export function NonRelationalTableData({
  rows,
  isLoading,
  isError,
  onRetry,
  emptyMessage = "No documents to see here.",
  pagination,
  bounded = true,
}: NonRelationalTableDataProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load"
        description="Something went wrong while fetching this data."
        onRetry={onRetry}
        className="py-16"
      />
    );
  }

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize))
    : 1;

  return (
    <div className="space-y-2.5">
      {rows.length > 0 ? (
        <div
          className={cn(
            "space-y-2",
            bounded && "custom-scrollbar max-h-112 overflow-y-auto",
          )}
        >
          {rows.map((row, i) => (
            <pre
              key={typeof row._id === "string" ? row._id : i}
              className="overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground"
            >
              {JSON.stringify(row, null, 2)}
            </pre>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border py-24 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}

      {pagination && totalPages > 1 && (
        <div
          className={cn(
            "flex items-center justify-end pr-1.5 gap-2.5",
          )}
        >
          <span className="text-[0.8125rem] text-muted-foreground">
            Page {pagination.pageIndex + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
              disabled={pagination.pageIndex === 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
              disabled={pagination.pageIndex >= totalPages - 1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
