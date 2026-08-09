import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { cn } from "@/lib/utils";
import type { DNSInstructions } from "@/lib/types";

interface DnsInstructionsProps {
  instructions: DNSInstructions;
}

export function DnsInstructions({ instructions }: DnsInstructionsProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Type</span>
        <span className="font-mono text-sm text-foreground">
          {instructions.recordType}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Host</span>
        <span
          className={cn(
            "text-sm text-foreground",
            instructions.recordType === "CNAME" ? "font-mono" : "",
          )}
        >
          {instructions.host}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">Value</span>
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-sm text-foreground">
            {instructions.value}
          </span>
          <CopyToClipboardButton text={instructions.value} />
        </div>
      </div>
    </div>
  );
}
