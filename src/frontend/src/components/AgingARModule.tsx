import type {
  AgingAR,
  ClaimRecord,
  backendInterface as FullBackendInterface,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

interface FollowUpNote {
  claimId: string;
  note: string;
  timestamp: string;
}

type BucketKey = "0-30" | "31-60" | "61-90" | "91+";

interface BucketConfig {
  key: BucketKey;
  label: string;
  sublabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  headerClass: string;
  textClass: string;
  dotClass: string;
}

const BUCKETS: BucketConfig[] = [
  {
    key: "0-30",
    label: "0–30 Days",
    sublabel: "Current",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    headerClass: "bg-emerald-600",
    textClass: "text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "31-60",
    label: "31–60 Days",
    sublabel: "Attention Needed",
    colorClass: "text-yellow-700",
    bgClass: "bg-yellow-50",
    borderClass: "border-yellow-200",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
    headerClass: "bg-yellow-500",
    textClass: "text-yellow-800",
    dotClass: "bg-yellow-500",
  },
  {
    key: "61-90",
    label: "61–90 Days",
    sublabel: "Overdue",
    colorClass: "text-orange-700",
    bgClass: "bg-orange-50",
    borderClass: "border-orange-200",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    headerClass: "bg-orange-500",
    textClass: "text-orange-800",
    dotClass: "bg-orange-500",
  },
  {
    key: "91+",
    label: "91+ Days",
    sublabel: "Critical — Action Required",
    colorClass: "text-red-700",
    bgClass: "bg-red-50",
    borderClass: "border-red-300",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    headerClass: "bg-red-600",
    textClass: "text-red-800",
    dotClass: "bg-red-500",
  },
];

function formatCurrency(val: string | number): string {
  const n = typeof val === "number" ? val : Number.parseFloat(String(val));
  if (Number.isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function calcDaysOutstanding(createdAt: bigint): number {
  const ms = Number(createdAt / 1_000_000n);
  const diffMs = Date.now() - ms;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatShortDate(createdAt: bigint): string {
  const ms = Number(createdAt / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function exportCSV(
  allClaims: Array<{ claim: ClaimRecord; bucket: BucketKey }>,
) {
  const headers = [
    "Claim ID",
    "Patient Name",
    "Payer/TPA",
    "Billed Amount",
    "Approved Amount",
    "Days Outstanding",
    "Bucket",
    "Status",
    "Submission Date",
  ];
  const rows = allClaims.map(({ claim, bucket }) => [
    claim.id,
    claim.patientName,
    claim.payerName || "—",
    claim.billedAmount,
    claim.approvedAmount || "—",
    calcDaysOutstanding(claim.createdAt).toString(),
    bucket,
    claim.status,
    formatShortDate(claim.createdAt),
  ]);
  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aging-ar-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Follow-Up Dialog
// ---------------------------------------------------------------------------

function FollowUpDialog({
  claim,
  onClose,
  onSave,
}: {
  claim: ClaimRecord;
  onClose: () => void;
  onSave: (note: FollowUpNote) => void;
}) {
  const [note, setNote] = useState("");

  function handleSave() {
    if (!note.trim()) return;
    onSave({
      claimId: claim.id,
      note: note.trim(),
      timestamp: new Date().toLocaleString("en-IN"),
    });
    toast.success("Follow-up note saved");
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="bg-white rounded-2xl border border-hp-border shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-hp-body text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-hp-blue" />
              Follow-Up Note
            </h3>
            <p className="text-xs text-hp-muted mt-0.5">
              {claim.id} · {claim.patientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hp-bg text-hp-muted hover:text-hp-body transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block">
              Payer / TPA
            </Label>
            <p className="text-sm font-medium text-hp-body bg-hp-bg rounded-lg px-3 py-2 border border-hp-border">
              {claim.payerName || "—"}
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block">
              Days Outstanding
            </Label>
            <p className="text-sm font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
              {calcDaysOutstanding(claim.createdAt)} days
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block">
              Follow-Up Note <span className="text-red-500">*</span>
            </Label>
            <Textarea
              data-ocid="aging-ar.followup.note.textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the follow-up action taken or planned..."
              rows={4}
              className="text-sm border-hp-border resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-hp-border"
          >
            Cancel
          </Button>
          <Button
            data-ocid="aging-ar.followup.save.button"
            size="sm"
            onClick={handleSave}
            disabled={!note.trim()}
            className="bg-hp-blue text-white hover:bg-hp-navy"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Save Note
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function BucketSummaryCard({
  config,
  claims,
  onClick,
}: {
  config: BucketConfig;
  claims: ClaimRecord[];
  onClick: () => void;
}) {
  const totalValue = claims.reduce(
    (acc, c) => acc + (Number.parseFloat(c.billedAmount) || 0),
    0,
  );

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      data-ocid={`aging-ar.bucket-summary.${config.key}`}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-all shadow-xs hover:shadow-md",
        config.bgClass,
        config.borderClass,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            config.colorClass,
          )}
        >
          {config.label}
        </span>
        <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      </div>
      <p className={cn("text-2xl font-bold mb-0.5", config.colorClass)}>
        {claims.length}
      </p>
      <p className="text-xs text-hp-muted">claims</p>
      <div className="mt-3 pt-3 border-t border-current/10">
        <p className={cn("text-sm font-bold", config.colorClass)}>
          {formatCurrency(totalValue)}
        </p>
        <p className="text-xs text-hp-muted">{config.sublabel}</p>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Claim Row
// ---------------------------------------------------------------------------

function ClaimRow({
  claim,
  bucketConfig,
  index,
  followUpNotes,
  onFollowUp,
  onEscalate,
  onViewClaim,
  isEscalated,
}: {
  claim: ClaimRecord;
  bucketConfig: BucketConfig;
  index: number;
  followUpNotes: FollowUpNote[];
  onFollowUp: () => void;
  onEscalate: () => void;
  onViewClaim: () => void;
  isEscalated: boolean;
}) {
  const days = calcDaysOutstanding(claim.createdAt);
  const hasNotes = followUpNotes.some((n) => n.claimId === claim.id);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      data-ocid={`aging-ar.claim-row.${claim.id}`}
      className="border-b border-hp-border last:border-0 hover:bg-hp-bg/60 transition-colors group"
    >
      <td className="px-4 py-3 text-xs font-mono text-hp-muted whitespace-nowrap">
        {claim.id.slice(-8).toUpperCase()}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-hp-body truncate max-w-[140px]">
          {claim.patientName}
        </p>
        {claim.packageName && (
          <p className="text-[10px] text-hp-muted truncate max-w-[140px]">
            {claim.packageName}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-hp-body whitespace-nowrap">
        {claim.payerName || "—"}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-hp-body text-right whitespace-nowrap">
        {formatCurrency(claim.billedAmount)}
      </td>
      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
        <span
          className={cn(
            "font-semibold",
            claim.approvedAmount ? "text-emerald-700" : "text-hp-muted",
          )}
        >
          {claim.approvedAmount
            ? formatCurrency(claim.approvedAmount)
            : "Pending"}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border",
            bucketConfig.badgeClass,
          )}
        >
          <Clock className="h-3 w-3" />
          {days}d
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            data-ocid={`aging-ar.followup.button.${claim.id}`}
            onClick={onFollowUp}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors border",
              hasNotes
                ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                : "bg-hp-bg text-hp-muted border-hp-border hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200",
            )}
            title="Add follow-up note"
          >
            <MessageSquare className="h-3 w-3" />
            {hasNotes ? "Notes" : "Follow Up"}
          </button>
          <button
            type="button"
            data-ocid={`aging-ar.escalate.button.${claim.id}`}
            onClick={onEscalate}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors border",
              isEscalated
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : "bg-hp-bg text-hp-muted border-hp-border hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200",
            )}
            title={isEscalated ? "Already escalated" : "Escalate claim"}
            disabled={isEscalated}
          >
            <ArrowUpRight className="h-3 w-3" />
            {isEscalated ? "Escalated" : "Escalate"}
          </button>
          <button
            type="button"
            data-ocid={`aging-ar.view-claim.button.${claim.id}`}
            onClick={onViewClaim}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors border bg-hp-bg text-hp-muted border-hp-border hover:bg-hp-blue hover:text-white hover:border-hp-blue"
            title="View in Claims module"
          >
            <TrendingUp className="h-3 w-3" />
            View
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// ---------------------------------------------------------------------------
// Bucket Table
// ---------------------------------------------------------------------------

function BucketTable({
  config,
  claims,
  followUpNotes,
  escalatedIds,
  onFollowUp,
  onEscalate,
  onViewClaim,
}: {
  config: BucketConfig;
  claims: ClaimRecord[];
  followUpNotes: FollowUpNote[];
  escalatedIds: Set<string>;
  onFollowUp: (claim: ClaimRecord) => void;
  onEscalate: (claimId: string) => void;
  onViewClaim: (claimId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalValue = claims.reduce(
    (acc, c) => acc + (Number.parseFloat(c.billedAmount) || 0),
    0,
  );

  return (
    <div
      className={cn(
        "rounded-xl border-2 overflow-hidden shadow-xs",
        config.borderClass,
      )}
    >
      {/* Bucket header */}
      <button
        type="button"
        data-ocid={`aging-ar.bucket-toggle.${config.key}`}
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "w-full flex items-center justify-between px-5 py-3.5 transition-colors",
          config.bgClass,
          "hover:brightness-[0.97]",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn("h-3 w-3 rounded-full shrink-0", config.dotClass)}
          />
          <div className="text-left">
            <p className={cn("font-bold text-sm", config.textClass)}>
              {config.label}
              <span className={cn("ml-2 text-xs font-medium opacity-70")}>
                — {config.sublabel}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-semibold", config.colorClass)}>
            {claims.length} claims · {formatCurrency(totalValue)}
          </span>
          {expanded ? (
            <ChevronUp className={cn("h-4 w-4", config.colorClass)} />
          ) : (
            <ChevronDown className={cn("h-4 w-4", config.colorClass)} />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {claims.length === 0 ? (
              <div className="px-6 py-8 text-center bg-white">
                <p className="text-sm text-hp-muted">
                  No claims in this bucket
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-hp-bg border-b border-hp-border">
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted">
                        Claim ID
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted">
                        Patient
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted">
                        Payer / TPA
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted text-right">
                        Billed
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted text-right">
                        Approved
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted text-right">
                        Days Out
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-hp-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim, i) => (
                      <ClaimRow
                        key={claim.id}
                        claim={claim}
                        bucketConfig={config}
                        index={i}
                        followUpNotes={followUpNotes}
                        isEscalated={escalatedIds.has(claim.id)}
                        onFollowUp={() => onFollowUp(claim)}
                        onEscalate={() => onEscalate(claim.id)}
                        onViewClaim={() => onViewClaim(claim.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function AgingARModule({
  onNavigate,
}: {
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const { actor, isFetching } = useActor();
  const typedActor = actor as FullBackendInterface | null;

  const [agingData, setAgingData] = useState<AgingAR | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [searchPatient, setSearchPatient] = useState("");
  const [filterPayer, setFilterPayer] = useState("all");
  const [filterBucket, setFilterBucket] = useState<"all" | BucketKey>("all");

  // Per-claim state
  const [followUpNotes, setFollowUpNotes] = useState<FollowUpNote[]>([]);
  const [escalatedIds, setEscalatedIds] = useState<Set<string>>(new Set());
  const [followUpTarget, setFollowUpTarget] = useState<ClaimRecord | null>(
    null,
  );

  const loadData = useCallback(async () => {
    if (!typedActor || isFetching) return;
    setIsLoading(true);
    try {
      const data = await typedActor.getAgingAR();
      setAgingData(data);
      setLastUpdated(new Date());
    } catch {
      toast.error("Failed to load Aging AR data");
    } finally {
      setIsLoading(false);
    }
  }, [typedActor, isFetching]);

  useEffect(() => {
    if (typedActor && !isFetching) loadData();
  }, [typedActor, isFetching, loadData]);

  // Collate all claims with bucket label
  const allClaims = agingData
    ? [
        ...agingData.bucket0to30.map((c) => ({
          claim: c,
          bucket: "0-30" as BucketKey,
        })),
        ...agingData.bucket31to60.map((c) => ({
          claim: c,
          bucket: "31-60" as BucketKey,
        })),
        ...agingData.bucket61to90.map((c) => ({
          claim: c,
          bucket: "61-90" as BucketKey,
        })),
        ...agingData.bucket91plus.map((c) => ({
          claim: c,
          bucket: "91+" as BucketKey,
        })),
      ]
    : [];

  // Unique payers for filter
  const allPayers = Array.from(
    new Set(allClaims.map((x) => x.claim.payerName).filter(Boolean)),
  ).sort();

  // Apply filters
  function filterClaims(claims: ClaimRecord[]): ClaimRecord[] {
    return claims.filter((c) => {
      const matchSearch =
        !searchPatient.trim() ||
        c.patientName.toLowerCase().includes(searchPatient.toLowerCase()) ||
        c.id.toLowerCase().includes(searchPatient.toLowerCase());
      const matchPayer = filterPayer === "all" || c.payerName === filterPayer;
      return matchSearch && matchPayer;
    });
  }

  const bucketClaims: Record<BucketKey, ClaimRecord[]> = {
    "0-30": filterClaims(agingData?.bucket0to30 ?? []),
    "31-60": filterClaims(agingData?.bucket31to60 ?? []),
    "61-90": filterClaims(agingData?.bucket61to90 ?? []),
    "91+": filterClaims(agingData?.bucket91plus ?? []),
  };

  const critical91Count = bucketClaims["91+"].length;

  function handleEscalate(claimId: string) {
    setEscalatedIds((prev) => {
      const next = new Set(prev);
      next.add(claimId);
      return next;
    });
    toast.success("Claim marked as escalated");
  }

  function handleViewClaim(claimId: string) {
    onNavigate?.("claims", { claimId });
  }

  function handleSaveFollowUp(note: FollowUpNote) {
    setFollowUpNotes((prev) => [...prev, note]);
  }

  function handleExport() {
    const filtered = allClaims.filter(({ claim, bucket }) => {
      const matchSearch =
        !searchPatient.trim() ||
        claim.patientName.toLowerCase().includes(searchPatient.toLowerCase());
      const matchPayer =
        filterPayer === "all" || claim.payerName === filterPayer;
      const matchBucket = filterBucket === "all" || bucket === filterBucket;
      return matchSearch && matchPayer && matchBucket;
    });
    exportCSV(filtered);
    toast.success(`Exported ${filtered.length} records to CSV`);
  }

  const bucketsToShow =
    filterBucket === "all"
      ? BUCKETS
      : BUCKETS.filter((b) => b.key === filterBucket);

  const totalOutstanding = agingData?.totalOutstanding ?? 0;

  return (
    <motion.main
      key="aging-ar"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="flex-1 bg-hp-bg"
    >
      {/* Module Header */}
      <div className="bg-gradient-to-r from-hp-blue to-hp-navy px-5 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-xl tracking-tight">
                  Aging AR Tracker
                </h1>
                <span className="text-[10px] bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  RCM
                </span>
              </div>
              <p className="text-white/70 text-xs mt-0.5">
                Accounts Receivable · ABDM + NABH Ready
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-white font-bold text-lg">
                {formatCurrency(totalOutstanding)}
              </p>
              <p className="text-white/60 text-xs">Total Outstanding</p>
            </div>
            <button
              type="button"
              data-ocid="aging-ar.refresh.button"
              onClick={loadData}
              disabled={isLoading}
              className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
              title="Refresh data"
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </button>
            <Button
              data-ocid="aging-ar.export.button"
              size="sm"
              onClick={handleExport}
              className="bg-white text-hp-blue font-bold hover:bg-blue-50 rounded-lg text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Workflow Banner */}
      <div className="max-w-screen-xl mx-auto px-5 pt-5">
        <WorkflowBanner
          currentStep="claims"
          onNavigate={(page) => onNavigate?.(page)}
        />
      </div>

      <div className="max-w-screen-xl mx-auto px-5 pb-8 space-y-6">
        {/* Last updated */}
        {lastUpdated && (
          <p className="text-xs text-hp-muted -mt-2">
            Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
          </p>
        )}

        {/* Critical Alert Banner */}
        <AnimatePresence>
          {!isLoading && critical91Count > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-600 rounded-xl px-5 py-3.5 flex items-center gap-3"
              data-ocid="aging-ar.critical-alert-banner"
            >
              <AlertTriangle className="h-5 w-5 text-white shrink-0 animate-pulse" />
              <p className="text-white font-semibold text-sm">
                <span className="font-black">
                  {critical91Count} claim{critical91Count !== 1 ? "s" : ""}
                </span>{" "}
                over 91 days need immediate attention —{" "}
                <span className="opacity-80">
                  {formatCurrency(
                    bucketClaims["91+"].reduce(
                      (acc, c) =>
                        acc + (Number.parseFloat(c.billedAmount) || 0),
                      0,
                    ),
                  )}{" "}
                  at risk
                </span>
              </p>
              <button
                type="button"
                onClick={() => setFilterBucket("91+")}
                className="ml-auto text-white/80 hover:text-white text-xs font-bold underline whitespace-nowrap"
              >
                View Critical →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {BUCKETS.map((b) => (
              <div
                key={b.key}
                className="h-28 rounded-xl bg-hp-bg animate-pulse border border-hp-border"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {BUCKETS.map((b) => (
              <BucketSummaryCard
                key={b.key}
                config={b}
                claims={bucketClaims[b.key]}
                onClick={() =>
                  setFilterBucket(filterBucket === b.key ? "all" : b.key)
                }
              />
            ))}
          </div>
        )}

        {/* Total Outstanding (mobile) */}
        <div className="sm:hidden bg-white rounded-xl border border-hp-border p-4 shadow-xs flex items-center justify-between">
          <p className="text-sm text-hp-muted font-medium">Total Outstanding</p>
          <p className="text-lg font-bold text-hp-blue">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-hp-border p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Input
                data-ocid="aging-ar.search.input"
                placeholder="Search by patient or claim ID..."
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                className="text-sm border-hp-border pr-3 pl-3"
              />
            </div>

            <Select value={filterPayer} onValueChange={setFilterPayer}>
              <SelectTrigger
                data-ocid="aging-ar.payer-filter.select"
                className="w-[180px] text-sm border-hp-border"
              >
                <SelectValue placeholder="All Payers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payers</SelectItem>
                {allPayers.map((p) => (
                  <SelectItem key={p} value={p} className="text-sm">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                data-ocid="aging-ar.bucket-filter.all"
                onClick={() => setFilterBucket("all")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  filterBucket === "all"
                    ? "bg-hp-blue text-white border-hp-blue"
                    : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40 hover:text-hp-body",
                )}
              >
                All Buckets
              </button>
              {BUCKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  data-ocid={`aging-ar.bucket-filter.${b.key}`}
                  onClick={() =>
                    setFilterBucket(filterBucket === b.key ? "all" : b.key)
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    filterBucket === b.key
                      ? `${b.badgeClass} border-current`
                      : "bg-white text-hp-muted border-hp-border hover:border-hp-border hover:text-hp-body",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {(searchPatient ||
              filterPayer !== "all" ||
              filterBucket !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchPatient("");
                  setFilterPayer("all");
                  setFilterBucket("all");
                }}
                className="text-xs text-hp-muted hover:text-hp-body flex items-center gap-1 ml-auto"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Bucket Tables */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-hp-bg animate-pulse border border-hp-border"
              />
            ))}
          </div>
        ) : allClaims.length === 0 ? (
          <div
            data-ocid="aging-ar.empty-state"
            className="bg-white rounded-xl border border-hp-border p-16 text-center shadow-xs"
          >
            <div className="w-16 h-16 bg-hp-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-hp-muted/40" />
            </div>
            <p className="font-semibold text-hp-body mb-1">
              No outstanding claims
            </p>
            <p className="text-sm text-hp-muted">
              All accounts receivable are settled. Check back after new claims
              are submitted.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bucketsToShow.map((config) => (
              <BucketTable
                key={config.key}
                config={config}
                claims={bucketClaims[config.key]}
                followUpNotes={followUpNotes}
                escalatedIds={escalatedIds}
                onFollowUp={(claim) => setFollowUpTarget(claim)}
                onEscalate={handleEscalate}
                onViewClaim={handleViewClaim}
              />
            ))}
          </div>
        )}
      </div>

      {/* Follow-Up Dialog */}
      <AnimatePresence>
        {followUpTarget && (
          <FollowUpDialog
            claim={followUpTarget}
            onClose={() => setFollowUpTarget(null)}
            onSave={handleSaveFollowUp}
          />
        )}
      </AnimatePresence>
    </motion.main>
  );
}
