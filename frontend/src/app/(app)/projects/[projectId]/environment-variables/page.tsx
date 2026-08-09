"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AddVariableDialog } from "@/components/environment/add-variable-dialog";
import { EditVariableDialog } from "@/components/environment/edit-variable-dialog";
import { DeleteVariableDialog } from "@/components/environment/delete-variable-dialog";
import { ImportVariablesDialog } from "@/components/environment/import-variables-dialog";
import { ResourceVariablesSection } from "@/components/environment/resource-variables-section";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import { ENV_FILENAME_PATTERN, maskValue, parseEnvFile } from "@/lib/utils";
import type { EnvironmentVariable, VariableEntry } from "@/lib/types";

const PAGE_SIZE = 10;

export default function EnvironmentVariablesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pagedFor, setPagedFor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EnvironmentVariable | null>(null);
  const [deleting, setDeleting] = useState<EnvironmentVariable | null>(null);
  const [importedVars, setImportedVars] = useState<VariableEntry[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const { data: variables, isLoading } = useQuery({
    queryKey: ["variables", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment
        ? api.environments.variables.list(projectId, selectedEnvironment.id)
        : null,
    enabled: !!selectedEnvironment,
  });

  if (selectedEnvironment && pagedFor !== selectedEnvironment.id) {
    setPagedFor(selectedEnvironment.id);
    setPageIndex(0);
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ENV_FILENAME_PATTERN.test(file.name)) {
      toast.error(`"${file.name}" doesn't look like an .env file`);
      return;
    }

    let parsed: VariableEntry[];
    try {
      parsed = parseEnvFile(await file.text());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to parse "${file.name}"`,
      );
      return;
    }

    if (parsed.length === 0) {
      toast.error(`No variables found in "${file.name}"`);
      return;
    }

    setImportedVars(parsed);
    setImportOpen(true);
  };

  const columns: ColumnDef<EnvironmentVariable>[] = [
    {
      accessorKey: "key",
      header: "Key",
      cell: ({ row }) => (
        <span className="font-mono text-foreground">{row.original.key}</span>
      ),
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => {
        const v = row.original;
        const isRevealed = revealed.has(v.id);
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-muted-foreground">
              {isRevealed ? v.value : maskValue(v.value)}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleReveal(v.id)}
              >
                {isRevealed ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
              <CopyToClipboardButton text={v.value} />
            </div>
          </div>
        );
      },
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.generated ? "System" : "User"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(row.original)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ];

  const pagedVariables = (variables ?? []).slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader title="Environment Variables">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <FileText className="size-3.25" />
          Import
        </Button>
        {variables && variables.length > 0 && (
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add Variable
          </Button>
        )}
      </PageHeader>

      {!isLoading && selectedEnvironment && variables?.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No environment variables"
          description="Add your first variable to configure this environment."
          action={{ label: "Add Variable", onClick: () => setAddOpen(true) }}
          className="py-16"
        />
      ) : (
        <DataTable
          columns={columns}
          data={pagedVariables}
          isLoading={isLoading || !selectedEnvironment}
          totalCount={variables?.length ?? 0}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
        />
      )}

      {selectedEnvironment && (
        <ResourceVariablesSection environmentId={selectedEnvironment.id} />
      )}

      {selectedEnvironment && (
        <>
          <AddVariableDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            projectId={projectId}
            environmentId={selectedEnvironment.id}
            onImportInstead={() => fileInputRef.current?.click()}
          />
          <EditVariableDialog
            open={!!editing}
            onOpenChange={(open) => !open && setEditing(null)}
            projectId={projectId}
            environmentId={selectedEnvironment.id}
            variable={editing}
          />
          <DeleteVariableDialog
            open={!!deleting}
            onOpenChange={(open) => !open && setDeleting(null)}
            projectId={projectId}
            environmentId={selectedEnvironment.id}
            variable={deleting}
          />
          <ImportVariablesDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            projectId={projectId}
            environmentId={selectedEnvironment.id}
            variables={importedVars}
          />
        </>
      )}
    </div>
  );
}
