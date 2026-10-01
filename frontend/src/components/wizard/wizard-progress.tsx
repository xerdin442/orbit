import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <ol className="flex items-center">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isLast = stepNumber === steps.length;

        return (
          <li key={label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary/10 text-primary ring-1 ring-primary",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "hidden text-[0.8125rem] font-medium sm:inline",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && <div className="mx-2 h-px w-6 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}
