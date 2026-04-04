import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  FileCheck,
  Receipt,
  Users,
} from "lucide-react";

const STEPS = [
  { key: "rcm", label: "Patient", icon: Users },
  { key: "preauth", label: "Pre-Auth", icon: FileCheck },
  { key: "clinicaldocs", label: "Clinical Docs", icon: ClipboardList },
  { key: "claims", label: "Claims", icon: Receipt },
  { key: "payment", label: "Payment", icon: CreditCard },
  { key: "denial", label: "Denial", icon: AlertTriangle },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function WorkflowBanner({
  currentStep,
  onNavigate,
}: {
  currentStep: StepKey;
  onNavigate: (page: string) => void;
}) {
  return (
    <div className="bg-white border border-hp-border rounded-xl px-3 py-2.5 mb-5 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const stepIdx = STEPS.findIndex((s) => s.key === currentStep);
          const isDone = i < stepIdx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-center gap-1">
              <button
                type="button"
                data-ocid={`workflow.${step.key}.tab`}
                onClick={() => onNavigate(step.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  isActive
                    ? "bg-hp-blue text-white shadow-sm"
                    : isDone
                      ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                      : "bg-hp-bg text-hp-muted hover:text-hp-body hover:bg-blue-50 border border-hp-border",
                )}
              >
                <Icon className="h-3 w-3" />
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <ArrowRight className="h-3 w-3 text-hp-muted shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
