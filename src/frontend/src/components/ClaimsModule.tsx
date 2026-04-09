import type {
  ClaimRecord,
  ClaimRequest,
  ClaimTimelineEvent,
  DocChecklistItem,
  backendInterface as FullBackendInterface,
  Patient,
  PreAuthRecord,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ValidationStatus } from "./ClaimValidationModule";
import { loadValidationRecord } from "./ClaimValidationModule";
import { WorkflowBanner } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateShort(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeShort(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function daysBetween(fromNs: bigint, toNs: bigint): number {
  const msFrom = Number(fromNs / 1_000_000n);
  const msTo = Number(toNs / 1_000_000n);
  return Math.round(Math.abs(msTo - msFrom) / (1000 * 60 * 60 * 24));
}

function daysFromNow(ns: bigint): number {
  const ms = Number(ns / 1_000_000n);
  return Math.round((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: string): string {
  const n = Number.parseFloat(val);
  if (Number.isNaN(n)) return val || "—";
  return `\u20b9${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const CLAIM_STATUSES = [
  "All",
  "Submitted",
  "UnderReview",
  "Settled",
  "Rejected",
  "Resubmitted",
];

// The ordered list of stages in the claim lifecycle
const TIMELINE_STAGES = [
  { key: "Submitted", label: "Submitted", tatHours: 0 },
  { key: "Acknowledged", label: "Acknowledged", tatHours: 2 },
  { key: "UnderReview", label: "Under Review", tatHours: 48 },
  { key: "Settled", label: "Settled", tatHours: 168 }, // 7 days
];

// Map status → stage index for "current" detection
const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  Submitted: 0,
  Acknowledged: 1,
  UnderReview: 2,
  Settled: 3,
  Rejected: 3,
  Resubmitted: 1,
  Draft: -1,
};

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    Draft: { label: "Draft", cls: "bg-gray-100 text-gray-600 border-gray-200" },
    Submitted: {
      label: "Submitted",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
    },
    UnderReview: {
      label: "Under Review",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    Settled: {
      label: "Settled",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    Rejected: {
      label: "Rejected",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    Resubmitted: {
      label: "Resubmitted",
      cls: "bg-purple-100 text-purple-700 border-purple-200",
    },
  };
  const c = config[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <Badge
      className={cn(
        "text-xs border rounded-full px-2 py-0.5 font-semibold",
        c.cls,
      )}
    >
      {c.label}
    </Badge>
  );
}

function ClaimTypeBadge({ claimType }: { claimType: string }) {
  const isCashless = claimType === "cashless";
  return (
    <Badge
      className={cn(
        "text-xs border rounded-full px-2 py-0.5 font-semibold",
        isCashless
          ? "bg-teal-100 text-teal-700 border-teal-200"
          : "bg-orange-100 text-orange-700 border-orange-200",
      )}
    >
      {isCashless ? "Cashless" : "Reimbursement"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Days Since Submission Badge
// ---------------------------------------------------------------------------

function DaysSinceBadge({ createdAt }: { createdAt: bigint }) {
  const days = daysFromNow(createdAt);
  const isDelayed = days > 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
        isDelayed
          ? "bg-red-50 text-red-600 border-red-200"
          : days > 3
            ? "bg-amber-50 text-amber-600 border-amber-200"
            : "bg-blue-50 text-blue-600 border-blue-200",
      )}
    >
      <Clock className="h-2.5 w-2.5" />
      {days === 0 ? "Today" : `${days}d`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Claim Timeline Component
// ---------------------------------------------------------------------------

interface TimelineStageInfo {
  key: string;
  label: string;
  event?: ClaimTimelineEvent;
  state: "completed" | "current" | "future" | "rejected";
  durationDays?: number;
}

function buildTimelineStages(claim: ClaimRecord): TimelineStageInfo[] {
  const isRejected = claim.status === "Rejected";
  const currentIndex = STATUS_TO_STAGE_INDEX[claim.status] ?? 0;

  // Build a lookup from stage key to timeline event
  const eventMap: Record<string, ClaimTimelineEvent> = {};
  for (const ev of claim.timelineEvents) {
    eventMap[ev.stage] = ev;
  }

  const stages: TimelineStageInfo[] = TIMELINE_STAGES.map((stage, index) => {
    const event = eventMap[stage.key];
    let state: TimelineStageInfo["state"];

    if (isRejected && index === 3) {
      state = "rejected";
    } else if (index < currentIndex) {
      state = "completed";
    } else if (index === currentIndex) {
      state = isRejected ? "rejected" : "current";
    } else {
      state = "future";
    }

    return { key: stage.key, label: stage.label, event, state };
  });

  // If rejected, replace last stage label with "Rejected"
  if (isRejected) {
    stages[3] = {
      ...stages[3],
      key: "Rejected",
      label: "Rejected",
      event: eventMap.Rejected ?? eventMap.UnderReview,
      state: "rejected",
    };
  }

  // Compute durations between consecutive completed stages
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const curr = stages[i];
    if (
      prev.event &&
      curr.event &&
      (curr.state === "completed" || curr.state === "current")
    ) {
      curr.durationDays = daysBetween(
        prev.event.timestamp,
        curr.event.timestamp,
      );
    }
  }

  return stages;
}

function ClaimTimeline({ claim }: { claim: ClaimRecord }) {
  const stages = buildTimelineStages(claim);
  const submissionTs =
    claim.timelineEvents.find((e) => e.stage === "Submitted")?.timestamp ??
    claim.createdAt;
  const latestTs =
    claim.timelineEvents.length > 0
      ? claim.timelineEvents.reduce(
          (max, e) => (e.timestamp > max ? e.timestamp : max),
          claim.timelineEvents[0].timestamp,
        )
      : claim.createdAt;
  const totalDays =
    daysBetween(submissionTs, latestTs) || daysFromNow(submissionTs);

  const isSettled = claim.status === "Settled";
  const isRejected = claim.status === "Rejected";
  const isOnTrack = totalDays <= 7;
  const isAckBreached =
    claim.timelineEvents.length === 1 && daysFromNow(submissionTs) > 0.083; // 2h in days

  // Compute % completion for progress bar
  const completedCount = stages.filter(
    (s) => s.state === "completed" || s.state === "current",
  ).length;
  const progressPct = Math.round(
    ((completedCount - 1) / (stages.length - 1)) * 100,
  );

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white border border-hp-border rounded-xl p-5 space-y-5">
      {/* Journey Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
            Claim Journey
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
              isSettled
                ? "bg-green-50 text-green-700 border-green-200"
                : isRejected
                  ? "bg-red-50 text-red-600 border-red-200"
                  : isOnTrack
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200",
            )}
          >
            {isSettled ? (
              <>
                <CheckCircle2 className="h-2.5 w-2.5" /> Settled
              </>
            ) : isRejected ? (
              <>
                <XCircle className="h-2.5 w-2.5" /> Rejected
              </>
            ) : isOnTrack ? (
              <>
                <CheckCircle2 className="h-2.5 w-2.5" /> On Track
              </>
            ) : (
              <>
                <AlertCircle className="h-2.5 w-2.5" /> Delayed
              </>
            )}
          </span>
          {isAckBreached && !isSettled && !isRejected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
              <AlertCircle className="h-2.5 w-2.5" /> Ack. overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-hp-muted">
          <span>
            <span className="font-bold text-hp-body">{totalDays}</span> day
            {totalDays !== 1 ? "s" : ""} elapsed
          </span>
          <span className="text-hp-border">|</span>
          <span>
            TAT target: <span className="font-bold text-hp-body">7 days</span>
          </span>
        </div>
      </div>

      {/* Horizontal progress bar */}
      <div className="relative">
        {/* Track */}
        <div className="absolute top-[14px] left-0 right-0 h-0.5 bg-gray-200 z-0" />
        {/* Fill */}
        <div
          className={cn(
            "absolute top-[14px] left-0 h-0.5 z-0 transition-all duration-500",
            isRejected
              ? "bg-gradient-to-r from-green-400 via-amber-400 to-red-400"
              : "bg-gradient-to-r from-green-400 to-green-500",
          )}
          style={{ width: `${Math.max(0, progressPct)}%` }}
        />

        {/* Stage nodes */}
        <div className="relative z-10 flex items-start justify-between">
          {stages.map((stage, i) => {
            const isLast = i === stages.length - 1;
            return (
              <div
                key={stage.key}
                className={cn(
                  "flex flex-col items-center text-center",
                  isLast
                    ? "items-end"
                    : i === 0
                      ? "items-start"
                      : "items-center",
                  "flex-1 min-w-0",
                )}
              >
                {/* Dot */}
                <div
                  className={cn(
                    "h-7 w-7 rounded-full border-2 flex items-center justify-center mb-2 transition-all duration-300",
                    stage.state === "completed" &&
                      "bg-green-500 border-green-600 shadow-[0_0_0_3px_rgba(34,197,94,0.15)]",
                    stage.state === "current" &&
                      "bg-amber-400 border-amber-500 shadow-[0_0_0_4px_rgba(251,191,36,0.25)] animate-pulse",
                    stage.state === "rejected" &&
                      "bg-red-500 border-red-600 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]",
                    stage.state === "future" && "bg-white border-gray-300",
                  )}
                >
                  {stage.state === "completed" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  )}
                  {stage.state === "current" && (
                    <Clock className="h-3.5 w-3.5 text-white" />
                  )}
                  {stage.state === "rejected" && (
                    <XCircle className="h-3.5 w-3.5 text-white" />
                  )}
                  {stage.state === "future" && (
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                  )}
                </div>

                {/* Label */}
                <p
                  className={cn(
                    "text-[10px] font-bold leading-tight",
                    stage.state === "completed" && "text-green-700",
                    stage.state === "current" && "text-amber-700",
                    stage.state === "rejected" && "text-red-700",
                    stage.state === "future" && "text-gray-400",
                  )}
                >
                  {stage.label}
                </p>

                {/* Date */}
                {stage.event ? (
                  <p className="text-[9px] text-hp-muted mt-0.5 leading-tight">
                    {formatDateShort(stage.event.timestamp)}
                  </p>
                ) : (
                  <p className="text-[9px] text-gray-300 mt-0.5">—</p>
                )}

                {/* Time */}
                {stage.event && (
                  <p className="text-[9px] text-hp-muted leading-tight">
                    {formatTimeShort(stage.event.timestamp)}
                  </p>
                )}

                {/* Duration between stages */}
                {stage.durationDays !== undefined &&
                  stage.durationDays >= 0 && (
                    <span
                      className={cn(
                        "mt-1 text-[9px] font-semibold px-1.5 py-0 rounded-full border",
                        stage.durationDays <= 1
                          ? "bg-green-50 text-green-600 border-green-200"
                          : stage.durationDays <= 3
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-red-50 text-red-600 border-red-200",
                      )}
                    >
                      +{stage.durationDays}d
                    </span>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline event log */}
      {claim.timelineEvents.length > 0 && (
        <div className="border-t border-hp-border pt-3">
          <p className="text-[10px] font-semibold text-hp-muted uppercase tracking-wider mb-2">
            Event Log
          </p>
          <div className="space-y-1.5">
            {[...claim.timelineEvents]
              .sort((a, b) => Number(a.timestamp - b.timestamp))
              .map((ev, i) => (
                <div
                  key={`${ev.stage}-${i}`}
                  className="flex items-start gap-2.5 text-xs"
                >
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-hp-blue/10 border border-hp-blue/20 flex items-center justify-center shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-hp-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-hp-body">
                      {ev.stage}
                    </span>
                    {ev.notes && (
                      <span className="text-hp-muted ml-1.5">— {ev.notes}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-hp-muted shrink-0 whitespace-nowrap">
                    {formatDateShort(ev.timestamp)}{" "}
                    {formatTimeShort(ev.timestamp)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard + FieldRow
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-hp-bg to-white border-b border-hp-border">
        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-hp-blue/10 text-hp-blue">
          {icon}
        </span>
        <h3 className="font-semibold text-hp-body text-sm">{title}</h3>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-hp-border p-4 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
            {label}
          </p>
          <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
          {sub && <p className="text-xs text-hp-muted mt-0.5">{sub}</p>}
        </div>
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            color
              .replace("text-", "bg-")
              .replace("700", "100")
              .replace("600", "100"),
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: New Claim Form
// ---------------------------------------------------------------------------

function NewClaimForm({
  actor,
  onSuccess,
  prefill,
  onPrefillConsumed,
}: {
  actor: FullBackendInterface | null;
  onSuccess: () => void;
  prefill?: Record<string, unknown>;
  onPrefillConsumed?: () => void;
}) {
  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const patientSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Pre-auth lookup
  const [preAuths, setPreAuths] = useState<PreAuthRecord[]>([]);
  const [selectedPreAuth, setSelectedPreAuth] = useState<PreAuthRecord | null>(
    null,
  );
  const [isLoadingPreAuths, setIsLoadingPreAuths] = useState(false);
  const prefillConsumed = useRef(false);

  // Form fields
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [billedAmount, setBilledAmount] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [procedureDetails, setProcedureDetails] = useState("");
  const [claimType, setClaimType] = useState<"cashless" | "reimbursement">(
    "cashless",
  );
  const [checklist, setChecklist] = useState<DocChecklistItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: prefillConsumed is a ref, stable across renders
  useEffect(() => {
    if (!prefill || prefillConsumed.current || !actor) return;
    const p = prefill as {
      patientId?: string;
      patientName?: string;
      preAuthId?: string;
      packageCode?: string;
      packageName?: string;
      diagnosisName?: string;
      schemeType?: string;
      payerName?: string;
    };
    if (!p.patientId) return;
    prefillConsumed.current = true;

    async function applyPrefill() {
      setPatientSearch(p.patientName ?? p.patientId ?? "");
      setIsSearchingPatient(true);
      try {
        const results = await actor!.searchPatients(p.patientId ?? "");
        setPatientResults([]);
        const patient =
          results.find((r) => r.id === p.patientId) ?? results[0] ?? null;
        if (patient) {
          setSelectedPatient(patient);
          setPatientSearch(patient.name);
          setIsLoadingPreAuths(true);
          try {
            const pas = await actor!.getPreAuthsByPatient(patient.id);
            const approved = pas.filter((pa) => pa.status === "Approved");
            setPreAuths(approved);
            if (p.preAuthId) {
              const pa = approved.find((a) => a.id === p.preAuthId);
              if (pa) {
                setSelectedPreAuth(pa);
              }
            }
          } catch {
            // noop
          } finally {
            setIsLoadingPreAuths(false);
          }
        }
      } catch {
        // noop
      } finally {
        setIsSearchingPatient(false);
      }
      onPrefillConsumed?.();
    }
    applyPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, actor]);

  const handlePatientSearchChange = useCallback(
    (value: string) => {
      setPatientSearch(value);
      setSelectedPatient(null);
      setPreAuths([]);
      setSelectedPreAuth(null);
      if (patientSearchTimeout.current)
        clearTimeout(patientSearchTimeout.current);
      if (!value.trim() || !actor) {
        setPatientResults([]);
        return;
      }
      patientSearchTimeout.current = setTimeout(async () => {
        setIsSearchingPatient(true);
        try {
          const results = await actor.searchPatients(value.trim());
          setPatientResults(results);
        } catch {
          setPatientResults([]);
        } finally {
          setIsSearchingPatient(false);
        }
      }, 400);
    },
    [actor],
  );

  async function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientSearch(p.name);
    setPatientResults([]);
    setSelectedPreAuth(null);
    if (!actor) return;
    setIsLoadingPreAuths(true);
    try {
      const pas = await actor.getPreAuthsByPatient(p.id);
      setPreAuths(pas.filter((pa) => pa.status === "Approved"));
    } catch {
      setPreAuths([]);
    } finally {
      setIsLoadingPreAuths(false);
    }
  }

  function selectPreAuth(preAuthId: string) {
    const pa = preAuths.find((p) => p.id === preAuthId);
    if (!pa) return;
    setSelectedPreAuth(pa);
    setChecklist(pa.documentChecklist.map((d) => ({ ...d, submitted: false })));
  }

  function toggleChecklist(index: number) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, submitted: !item.submitted } : item,
      ),
    );
  }

  async function handleSubmit() {
    if (!selectedPatient || !actor) return;
    if (!admissionDate || !dischargeDate || !billedAmount) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    const req: ClaimRequest = {
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      preAuthId: selectedPreAuth?.id ?? "",
      packageCode: selectedPreAuth?.packageCode ?? "",
      packageName: selectedPreAuth?.packageName ?? "",
      diagnosisName: selectedPreAuth?.diagnosisName ?? "",
      schemeType: selectedPreAuth?.schemeType ?? "",
      payerName: selectedPatient.payerName ?? "",
      admissionDate,
      dischargeDate,
      billedAmount,
      approvedAmount,
      icdCode,
      procedureDetails,
      claimType,
      documentChecklist: checklist,
    };
    try {
      const result = await actor.createClaim(req);
      if ("ok" in result) {
        toast.success(`Claim submitted successfully. ID: ${result.ok}`);
        setSelectedPatient(null);
        setPatientSearch("");
        setPreAuths([]);
        setSelectedPreAuth(null);
        setAdmissionDate("");
        setDischargeDate("");
        setBilledAmount("");
        setApprovedAmount("");
        setIcdCode("");
        setProcedureDetails("");
        setClaimType("cashless");
        setChecklist([]);
        onSuccess();
      } else {
        toast.error(`Failed: ${result.err}`);
      }
    } catch {
      toast.error("Error submitting claim");
    } finally {
      setIsSubmitting(false);
    }
  }

  const submittedCount = checklist.filter((d) => d.submitted).length;

  return (
    <div className="space-y-5">
      {/* Patient Search */}
      <SectionCard
        title="Patient Selection"
        icon={<Search className="h-4 w-4" />}
        badge={
          selectedPatient ? (
            <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs rounded-full">
              Selected
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <FieldRow label="Search Patient" required>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
              <Input
                data-ocid="claims.patient.search_input"
                placeholder="Type patient name or ID..."
                value={patientSearch}
                onChange={(e) => handlePatientSearchChange(e.target.value)}
                className="pl-8 text-sm border-hp-border"
              />
              {isSearchingPatient && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-hp-muted" />
              )}
              {patientResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-hp-border rounded-xl shadow-lg overflow-hidden">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-3 hover:bg-hp-bg transition-colors border-b border-hp-border last:border-0"
                    >
                      <p className="text-sm font-semibold text-hp-body">
                        {p.name}
                      </p>
                      <p className="text-xs text-hp-muted">
                        {p.id} · {p.dob} · {p.payerName || p.payerType}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FieldRow>

          {selectedPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-hp-muted">Name: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPatient.name}
                </span>
              </div>
              <div>
                <span className="text-hp-muted">Payer: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPatient.payerName || selectedPatient.payerType}
                </span>
              </div>
              <div>
                <span className="text-hp-muted">DOB: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPatient.dob}
                </span>
              </div>
              <div>
                <span className="text-hp-muted">Eligibility: </span>
                <span
                  className={cn(
                    "font-semibold",
                    selectedPatient.eligibilityStatus === "Eligible"
                      ? "text-green-700"
                      : "text-amber-700",
                  )}
                >
                  {selectedPatient.eligibilityStatus}
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Pre-Auth Lookup */}
      {selectedPatient && (
        <SectionCard
          title="Pre-Authorization Reference"
          icon={<Receipt className="h-4 w-4" />}
          badge={
            selectedPreAuth ? (
              <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs rounded-full">
                Linked
              </Badge>
            ) : undefined
          }
        >
          {isLoadingPreAuths ? (
            <div className="flex items-center gap-2 text-hp-muted text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading approved pre-authorizations...
            </div>
          ) : preAuths.length === 0 ? (
            <p className="text-sm text-hp-muted">
              No approved pre-authorizations found for this patient.
            </p>
          ) : (
            <FieldRow label="Select Approved Pre-Auth" required>
              <Select
                value={selectedPreAuth?.id ?? ""}
                onValueChange={selectPreAuth}
              >
                <SelectTrigger
                  data-ocid="claims.preauth.select"
                  className="text-sm border-hp-border"
                >
                  <SelectValue placeholder="Select a pre-authorization..." />
                </SelectTrigger>
                <SelectContent>
                  {preAuths.map((pa) => (
                    <SelectItem key={pa.id} value={pa.id} className="text-sm">
                      {pa.id} — {pa.packageName} ({pa.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          {selectedPreAuth && (
            <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-hp-muted">Package: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPreAuth.packageCode}
                </span>
              </div>
              <div>
                <span className="text-hp-muted">Scheme: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPreAuth.schemeType}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-hp-muted">Diagnosis: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPreAuth.diagnosisName}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-hp-muted">Package Name: </span>
                <span className="font-semibold text-hp-body">
                  {selectedPreAuth.packageName}
                </span>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Claim Details */}
      <SectionCard
        title="Claim Details"
        icon={<CreditCard className="h-4 w-4" />}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <FieldRow label="Admission Date" required>
            <Input
              data-ocid="claims.admission_date.input"
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              className="text-sm border-hp-border"
            />
          </FieldRow>
          <FieldRow label="Discharge Date" required>
            <Input
              data-ocid="claims.discharge_date.input"
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="text-sm border-hp-border"
            />
          </FieldRow>
          <FieldRow label="Billed Amount (₹)" required>
            <Input
              data-ocid="claims.billed_amount.input"
              placeholder="e.g. 45000"
              value={billedAmount}
              onChange={(e) => setBilledAmount(e.target.value)}
              className="text-sm border-hp-border"
            />
          </FieldRow>
          <FieldRow label="Approved Amount (₹)">
            <Input
              data-ocid="claims.approved_amount.input"
              placeholder="e.g. 40000"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
              className="text-sm border-hp-border"
            />
          </FieldRow>
          <FieldRow label="ICD Code">
            <Input
              data-ocid="claims.icd_code.input"
              placeholder="e.g. K35.8"
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value)}
              className="text-sm border-hp-border font-mono"
            />
          </FieldRow>
          <FieldRow label="Claim Type" required>
            <div className="flex items-center gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-ocid="claims.claim_type.cashless.radio"
                  type="radio"
                  name="claimType"
                  value="cashless"
                  checked={claimType === "cashless"}
                  onChange={() => setClaimType("cashless")}
                  className="accent-hp-blue"
                />
                <span className="text-sm font-medium text-hp-body">
                  Cashless
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-ocid="claims.claim_type.reimbursement.radio"
                  type="radio"
                  name="claimType"
                  value="reimbursement"
                  checked={claimType === "reimbursement"}
                  onChange={() => setClaimType("reimbursement")}
                  className="accent-hp-blue"
                />
                <span className="text-sm font-medium text-hp-body">
                  Reimbursement
                </span>
              </label>
            </div>
          </FieldRow>
          <FieldRow label="Procedure Details" required>
            <Textarea
              data-ocid="claims.procedure_details.textarea"
              placeholder="Describe the procedure performed..."
              value={procedureDetails}
              onChange={(e) => setProcedureDetails(e.target.value)}
              rows={3}
              className="text-sm border-hp-border resize-none col-span-2 sm:col-span-2"
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* Document Checklist */}
      {checklist.length > 0 && (
        <SectionCard
          title="Document Checklist"
          icon={<CheckCircle2 className="h-4 w-4" />}
          badge={
            <span className="text-xs text-hp-muted">
              {submittedCount}/{checklist.length} submitted
            </span>
          }
        >
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div
                key={item.docName}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  item.submitted
                    ? "bg-green-50 border-green-200"
                    : item.required
                      ? "bg-red-50/40 border-red-100"
                      : "bg-gray-50 border-hp-border",
                )}
              >
                <Checkbox
                  data-ocid={`claims.doc_checklist.checkbox.${i + 1}`}
                  checked={item.submitted}
                  onCheckedChange={() => toggleChecklist(i)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.submitted
                        ? "text-green-800 line-through"
                        : "text-hp-body",
                    )}
                  >
                    {item.docName}
                  </p>
                  <Badge
                    className={cn(
                      "text-[10px] mt-1 px-1.5 py-0 rounded-full border font-semibold",
                      item.required
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-gray-50 text-gray-500 border-gray-200",
                    )}
                  >
                    {item.required ? "Required" : "Optional"}
                  </Badge>
                </div>
                {item.submitted && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          data-ocid="claims.submit.primary_button"
          onClick={handleSubmit}
          disabled={!selectedPatient || isSubmitting || !actor}
          className="bg-hp-blue text-white font-bold hover:bg-hp-navy rounded-xl px-8"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {isSubmitting ? "Submitting..." : "Submit Claim"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Validation Status Badge (reads from localStorage)
// ---------------------------------------------------------------------------

function InlineValidationBadge({ claimId }: { claimId: string }) {
  const record = loadValidationRecord(claimId);
  const status: ValidationStatus = record?.validationStatus ?? "NotValidated";

  const config: Record<
    ValidationStatus,
    { label: string; icon: React.ReactNode; cls: string }
  > = {
    Pass: {
      label: "Validated",
      icon: <ShieldCheck className="h-3 w-3" />,
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    Warnings: {
      label: "Warnings",
      icon: <ShieldAlert className="h-3 w-3" />,
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    Failed: {
      label: "Doc Failed",
      icon: <ShieldX className="h-3 w-3" />,
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    NotValidated: {
      label: "Not Validated",
      icon: <Shield className="h-3 w-3" />,
      cls: "bg-gray-100 text-gray-500 border-gray-200",
    },
  };
  const c = config[status];
  return (
    <Badge
      className={cn(
        "text-xs border rounded-full px-2 py-0.5 font-semibold flex items-center gap-1",
        c.cls,
      )}
    >
      {c.icon}
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Claims List — ClaimCard
// ---------------------------------------------------------------------------

function ClaimCard({
  claim,
  index,
  actor,
  onRefresh,
  onNavigate,
}: {
  claim: ClaimRecord;
  index: number;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const submittedDocs = claim.documentChecklist.filter(
    (d) => d.submitted,
  ).length;
  const totalDocs = claim.documentChecklist.length;

  async function handleStatusUpdate() {
    if (!actor || !statusUpdate) return;
    setIsUpdating(true);
    try {
      const ok = await actor.updateClaimStatus(claim.id, statusUpdate, remarks);
      if (ok) {
        toast.success(`Claim status updated to ${statusUpdate}`);
        setStatusUpdate("");
        setRemarks("");
        onRefresh();
      } else {
        toast.error("Failed to update claim status");
      }
    } catch {
      toast.error("Error updating claim");
    } finally {
      setIsUpdating(false);
    }
  }

  const daysSince = daysFromNow(claim.createdAt);
  const hasTimeline = claim.timelineEvents && claim.timelineEvents.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      data-ocid={`claims.list.item.${index + 1}`}
      className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-hp-body">
                {claim.patientName}
              </p>
              <ClaimStatusBadge status={claim.status} />
              <ClaimTypeBadge claimType={claim.claimType} />
              {/* Days since submission badge */}
              <DaysSinceBadge createdAt={claim.createdAt} />
              {/* Validation badge */}
              <InlineValidationBadge claimId={claim.id} />
            </div>
            <p className="text-xs text-hp-muted mt-0.5">
              {claim.id} · {formatDateTime(claim.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-hp-blue">
              {formatCurrency(claim.billedAmount)}
            </p>
            <p className="text-xs text-hp-muted">billed</p>
          </div>
        </div>

        {/* Package + Pre-Auth */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {claim.packageCode && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded">
              {claim.packageCode}
            </span>
          )}
          {claim.packageName && (
            <span className="text-[10px] text-hp-muted bg-hp-bg px-2 py-0.5 rounded border border-hp-border truncate max-w-[200px]">
              {claim.packageName}
            </span>
          )}
        </div>

        {/* Doc summary */}
        {totalDocs > 0 && (
          <p className="text-xs text-hp-muted mt-2">
            Docs: {submittedDocs}/{totalDocs} submitted
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Select
            value={statusUpdate}
            onValueChange={setStatusUpdate}
            disabled={isUpdating}
          >
            <SelectTrigger
              data-ocid={`claims.list.status.select.${index + 1}`}
              className="h-8 text-xs border-hp-border w-36"
            >
              <SelectValue placeholder="Update status..." />
            </SelectTrigger>
            <SelectContent>
              {["UnderReview", "Settled", "Rejected", "Resubmitted"].map(
                (s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s === "UnderReview" ? "Under Review" : s}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {statusUpdate && (
            <Input
              data-ocid={`claims.list.remarks.input.${index + 1}`}
              placeholder="Remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="h-8 text-xs border-hp-border flex-1 min-w-[120px]"
            />
          )}
          {statusUpdate && (
            <Button
              data-ocid={`claims.list.save.button.${index + 1}`}
              size="sm"
              onClick={handleStatusUpdate}
              disabled={isUpdating}
              className="h-8 text-xs bg-hp-blue text-white hover:bg-hp-navy"
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          )}
          {claim.status === "Settled" && onNavigate && (
            <Button
              data-ocid={`claims.record_payment.button.${index + 1}`}
              size="sm"
              onClick={() =>
                onNavigate("payment", {
                  claimId: claim.id,
                  patientId: claim.patientId,
                  patientName: claim.patientName,
                  payerName: claim.payerName,
                  billedAmount: claim.billedAmount,
                  approvedAmount: claim.approvedAmount,
                })
              }
              className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5"
            >
              <Banknote className="h-3.5 w-3.5" />
              Record Payment
            </Button>
          )}
          {onNavigate && (
            <Button
              data-ocid={`claims.validate_docs.button.${index + 1}`}
              size="sm"
              onClick={() =>
                onNavigate("claim-validation", { claimId: claim.id })
              }
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Validate Docs
            </Button>
          )}

          {/* Timeline toggle */}
          <button
            type="button"
            data-ocid={`claims.timeline.toggle.${index + 1}`}
            onClick={() => setTimelineOpen((t) => !t)}
            className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
              timelineOpen
                ? "bg-hp-blue text-white border-hp-blue"
                : "bg-white text-hp-blue border-hp-blue/40 hover:bg-hp-blue/5",
            )}
            title="View Claim Timeline"
          >
            <Clock className="h-3 w-3" />
            {timelineOpen ? "Hide Timeline" : "View Timeline"}
            {hasTimeline && !timelineOpen && (
              <span className="ml-0.5 bg-hp-blue text-white text-[9px] font-bold px-1 rounded-full">
                {claim.timelineEvents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-ocid={`claims.list.toggle.${index + 1}`}
            onClick={() => setExpanded((e) => !e)}
            className="ml-auto flex items-center gap-1 text-xs text-hp-muted hover:text-hp-body transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* Timeline Section */}
      <AnimatePresence>
        {timelineOpen && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-hp-border overflow-hidden"
          >
            <div className="px-5 py-4 bg-gradient-to-b from-blue-50/30 to-white">
              <ClaimTimeline claim={claim} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-hp-border overflow-hidden"
          >
            <div className="px-5 py-4 bg-hp-bg/40 space-y-3">
              {/* Journey Summary */}
              <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-hp-border">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-hp-muted" />
                  <span className="text-xs text-hp-muted">Journey:</span>
                  <span className="text-xs font-bold text-hp-body">
                    {daysSince} day{daysSince !== 1 ? "s" : ""} since submission
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    daysSince <= 7
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200",
                  )}
                >
                  {daysSince <= 7 ? (
                    <>
                      <CheckCircle2 className="h-2.5 w-2.5" /> On Track (target:
                      7d)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-2.5 w-2.5" /> Delayed (target:
                      7d)
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                {claim.preAuthId && (
                  <div>
                    <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                      Pre-Auth ID
                    </p>
                    <p className="font-mono text-hp-body">{claim.preAuthId}</p>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                    Admission
                  </p>
                  <p className="text-hp-body">{claim.admissionDate || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                    Discharge
                  </p>
                  <p className="text-hp-body">{claim.dischargeDate || "—"}</p>
                </div>
                {claim.icdCode && (
                  <div>
                    <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                      ICD Code
                    </p>
                    <p className="font-mono text-hp-body">{claim.icdCode}</p>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                    Approved Amount
                  </p>
                  <p className="font-semibold text-green-700">
                    {claim.approvedAmount
                      ? formatCurrency(claim.approvedAmount)
                      : "Pending"}
                  </p>
                </div>
                {claim.status === "Settled" && claim.settlementDate && (
                  <div>
                    <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px]">
                      Settlement Date
                    </p>
                    <p className="text-hp-body">{claim.settlementDate}</p>
                  </div>
                )}
              </div>

              {claim.procedureDetails && (
                <div className="text-xs">
                  <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px] mb-1">
                    Procedure Details
                  </p>
                  <p className="text-hp-body bg-white border border-hp-border rounded-lg p-3 leading-relaxed">
                    {claim.procedureDetails}
                  </p>
                </div>
              )}

              {claim.status === "Rejected" && claim.rejectionRemarks && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-red-700 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Rejection Remarks
                  </p>
                  <p className="text-red-800">{claim.rejectionRemarks}</p>
                </div>
              )}

              {claim.documentChecklist.length > 0 && (
                <div>
                  <p className="font-semibold text-hp-muted uppercase tracking-wider text-[10px] mb-2">
                    Document Checklist ({submittedDocs}/{totalDocs})
                  </p>
                  <div className="space-y-1.5">
                    {claim.documentChecklist.map((doc) => (
                      <div
                        key={doc.docName}
                        className={cn(
                          "flex items-center gap-2 text-xs px-3 py-2 rounded-lg border",
                          doc.submitted
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-gray-50 border-gray-200 text-hp-muted",
                        )}
                      >
                        <CheckCircle2
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            doc.submitted ? "text-green-500" : "text-gray-300",
                          )}
                        />
                        <span
                          className={cn(
                            doc.submitted ? "text-green-700" : "text-hp-muted",
                          )}
                        >
                          {doc.docName}
                        </span>
                        {doc.required && !doc.submitted && (
                          <Badge className="ml-auto text-[10px] bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0">
                            Required
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ClaimsListTab({
  claims,
  isLoading,
  actor,
  onRefresh,
  onNavigate,
}: {
  claims: ClaimRecord[];
  isLoading: boolean;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = claims.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.patientName.toLowerCase().includes(q) ||
      c.packageCode.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
          <Input
            data-ocid="claims.list.search_input"
            placeholder="Search by patient name, package code, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm border-hp-border"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CLAIM_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              data-ocid="claims.list.filter.tab"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                statusFilter === s
                  ? "bg-hp-blue text-white border-hp-blue"
                  : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40 hover:text-hp-body",
              )}
            >
              {s === "UnderReview" ? "Under Review" : s}
              {s !== "All" && (
                <span className="ml-1 opacity-70">
                  ({claims.filter((c) => c.status === s).length})
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            data-ocid="claims.list.refresh.button"
            onClick={onRefresh}
            className="ml-auto p-1.5 rounded-lg text-hp-muted hover:text-hp-body hover:bg-hp-bg border border-hp-border transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div
          data-ocid="claims.list.loading_state"
          className="flex items-center justify-center py-16 gap-3 text-hp-muted"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading claims...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-ocid="claims.list.empty_state"
          className="text-center py-16 text-hp-muted"
        >
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {claims.length === 0
              ? "No claims submitted yet"
              : "No claims match your filters"}
          </p>
          <p className="text-xs mt-1">
            {claims.length === 0
              ? 'Submit a new claim from the "New Claim" tab'
              : "Try adjusting your search or filter"}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filtered.map((claim, i) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                index={i}
                actor={actor}
                onRefresh={onRefresh}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Dashboard
// ---------------------------------------------------------------------------

function ClaimsDashboard({ claims }: { claims: ClaimRecord[] }) {
  const total = claims.length;
  const submitted = claims.filter((c) => c.status === "Submitted").length;
  const underReview = claims.filter((c) => c.status === "UnderReview").length;
  const settled = claims.filter((c) => c.status === "Settled").length;
  const rejected = claims.filter((c) => c.status === "Rejected").length;

  const totalBilled = claims.reduce(
    (acc, c) => acc + (Number.parseFloat(c.billedAmount) || 0),
    0,
  );
  const totalSettled = claims
    .filter((c) => c.status === "Settled")
    .reduce((acc, c) => acc + (Number.parseFloat(c.approvedAmount) || 0), 0);

  const settlementRate = total > 0 ? Math.round((settled / total) * 100) : 0;

  const cashlessCount = claims.filter((c) => c.claimType === "cashless").length;
  const reimbursementCount = claims.filter(
    (c) => c.claimType === "reimbursement",
  ).length;

  // Claims by aging bucket
  const agingBuckets = {
    "0-7d": claims.filter((c) => daysFromNow(c.createdAt) <= 7).length,
    "8-14d": claims.filter((c) => {
      const d = daysFromNow(c.createdAt);
      return d > 7 && d <= 14;
    }).length,
    "15-30d": claims.filter((c) => {
      const d = daysFromNow(c.createdAt);
      return d > 14 && d <= 30;
    }).length,
    "30d+": claims.filter((c) => daysFromNow(c.createdAt) > 30).length,
  };

  const recent5 = [...claims]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Claims"
          value={total}
          color="text-hp-blue"
          icon={<Receipt className="h-5 w-5 text-hp-blue" />}
        />
        <StatCard
          label="Submitted"
          value={submitted}
          color="text-blue-600"
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          label="Under Review"
          value={underReview}
          color="text-amber-600"
          icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
        />
        <StatCard
          label="Settled"
          value={settled}
          color="text-green-600"
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          color="text-red-600"
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
        />
      </div>

      {/* Financial + Settlement */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
          <h3 className="text-sm font-bold text-hp-body mb-3">
            Financial Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-hp-muted">Total Billed</span>
              <span className="font-bold text-hp-body">
                {formatCurrency(totalBilled.toString())}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-hp-muted">Total Settled</span>
              <span className="font-bold text-green-700">
                {formatCurrency(totalSettled.toString())}
              </span>
            </div>
            <div className="h-px bg-hp-border" />
            <div className="flex justify-between text-sm">
              <span className="text-hp-muted">Settlement Rate</span>
              <span
                className={cn(
                  "font-bold",
                  settlementRate >= 70 ? "text-green-700" : "text-amber-600",
                )}
              >
                {settlementRate}%
              </span>
            </div>
            <Progress value={settlementRate} className="h-2.5 rounded-full" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
          <h3 className="text-sm font-bold text-hp-body mb-3">
            Claim Type Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-teal-400" />
                <span className="text-sm text-hp-muted">Cashless</span>
              </div>
              <span className="font-bold text-hp-body">{cashlessCount}</span>
            </div>
            <Progress
              value={total > 0 ? (cashlessCount / total) * 100 : 0}
              className="h-2 rounded-full"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-400" />
                <span className="text-sm text-hp-muted">Reimbursement</span>
              </div>
              <span className="font-bold text-hp-body">
                {reimbursementCount}
              </span>
            </div>
            <Progress
              value={total > 0 ? (reimbursementCount / total) * 100 : 0}
              className="h-2 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
        <h3 className="text-sm font-bold text-hp-body mb-4">
          Claims Aging Analysis
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(agingBuckets).map(([label, count]) => {
            const isAlert = label === "15-30d" || label === "30d+";
            return (
              <div
                key={label}
                className={cn(
                  "rounded-lg border p-3 text-center",
                  label === "0-7d"
                    ? "bg-green-50 border-green-200"
                    : label === "8-14d"
                      ? "bg-amber-50 border-amber-200"
                      : label === "15-30d"
                        ? "bg-orange-50 border-orange-200"
                        : "bg-red-50 border-red-200",
                )}
              >
                <p
                  className={cn(
                    "text-xl font-bold",
                    label === "0-7d"
                      ? "text-green-700"
                      : label === "8-14d"
                        ? "text-amber-700"
                        : label === "15-30d"
                          ? "text-orange-700"
                          : "text-red-700",
                  )}
                >
                  {count}
                </p>
                <p className="text-[10px] font-semibold text-hp-muted mt-0.5">
                  {label}
                </p>
                {isAlert && count > 0 && (
                  <AlertCircle className="h-3 w-3 mx-auto mt-1 text-red-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent 5 Claims */}
      <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
        <h3 className="text-sm font-bold text-hp-body mb-3">Recent Claims</h3>
        {recent5.length === 0 ? (
          <p className="text-sm text-hp-muted text-center py-6">
            No claims yet
          </p>
        ) : (
          <div className="space-y-2">
            {recent5.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-hp-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-hp-body truncate">
                      {c.patientName}
                    </p>
                    <DaysSinceBadge createdAt={c.createdAt} />
                  </div>
                  <p className="text-xs text-hp-muted">
                    {c.id} · {c.packageCode}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ClaimStatusBadge status={c.status} />
                  <span className="text-sm font-bold text-hp-blue">
                    {formatCurrency(c.billedAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function ClaimsModule({
  onNavigate,
  prefill,
  onPrefillConsumed,
}: {
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
  prefill?: Record<string, unknown>;
  onPrefillConsumed?: () => void;
} = {}) {
  const { actor, isFetching } = useActor();
  const typedActor = actor as FullBackendInterface | null;

  const [activeTab, setActiveTab] = useState<"new" | "list" | "dashboard">(
    "new",
  );
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!typedActor || isFetching) return;
    setIsLoadingClaims(true);
    try {
      const data = await typedActor.getClaims();
      setClaims(data);
    } catch {
      toast.error("Failed to load claims");
    } finally {
      setIsLoadingClaims(false);
    }
  }, [typedActor, isFetching]);

  useEffect(() => {
    if (typedActor && !isFetching) {
      loadClaims();
    }
  }, [typedActor, isFetching, loadClaims]);

  function handleTabChange(value: string) {
    setActiveTab(value as "new" | "list" | "dashboard");
    if (value === "list" || value === "dashboard") {
      loadClaims();
    }
  }

  function handleNewClaimSuccess() {
    setActiveTab("list");
    loadClaims();
  }

  const settledCount = claims.filter((c) => c.status === "Settled").length;
  const rejectedCount = claims.filter((c) => c.status === "Rejected").length;
  const delayedCount = claims.filter(
    (c) =>
      c.status !== "Settled" &&
      c.status !== "Rejected" &&
      daysFromNow(c.createdAt) > 7,
  ).length;

  return (
    <motion.main
      key="claims"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="flex-1 bg-hp-bg"
    >
      {/* Module Header */}
      <div className="bg-gradient-to-r from-hp-blue to-hp-navy px-5 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-xl tracking-tight">
                Claims Submission & Tracking
              </h1>
              <span className="text-[10px] bg-emerald-400 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                Module 4
              </span>
            </div>
            <p className="text-white/70 text-xs mt-0.5">
              End-to-end claims management · Visual timeline · ABDM + NABH Ready
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            {delayedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs rounded-lg px-3 py-1.5">
                <Clock className="h-3.5 w-3.5" />
                {delayedCount} delayed
              </div>
            )}
            {rejectedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 text-red-200 text-xs rounded-lg px-3 py-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {rejectedCount} rejected
              </div>
            )}
            {settledCount > 0 && (
              <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 text-green-200 text-xs rounded-lg px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {settledCount} settled
              </div>
            )}
            <div className="text-white/60 text-xs">
              {claims.length} claim{claims.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <WorkflowBanner
          currentStep="rcm-workflow"
          onNavigate={(page) => onNavigate?.(page)}
        />
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white border border-hp-border rounded-xl h-10 mb-6 p-1">
            <TabsTrigger
              data-ocid="claims.new.tab"
              value="new"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Claim
            </TabsTrigger>
            <TabsTrigger
              data-ocid="claims.list.tab"
              value="list"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Claims List
              {claims.length > 0 && (
                <span className="ml-1.5 bg-hp-blue/20 text-hp-blue text-[10px] font-bold px-1.5 py-0.5 rounded-full data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {claims.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              data-ocid="claims.dashboard.tab"
              value="dashboard"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-0">
            <NewClaimForm
              actor={typedActor}
              onSuccess={handleNewClaimSuccess}
              prefill={prefill}
              onPrefillConsumed={onPrefillConsumed}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <ClaimsListTab
              claims={claims}
              isLoading={isLoadingClaims}
              actor={typedActor}
              onRefresh={loadClaims}
              onNavigate={onNavigate}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            <ClaimsDashboard claims={claims} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.main>
  );
}
