import type {
  DocChecklistItem,
  backendInterface as FullBackendInterface,
  Patient,
  PreAuthRecord,
  PreAuthRequest,
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
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Local types (not in backend.d.ts)
// ---------------------------------------------------------------------------

interface DoctorMaster {
  id: string;
  name: string;
  specialisation: string;
  isActive: boolean;
  phone: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIAGNOSIS_SUGGESTIONS: { keyword: string; code: string; name: string }[] =
  [
    {
      keyword: "appendicitis",
      code: "SUR001",
      name: "Laparoscopic Appendectomy",
    },
    { keyword: "appendix", code: "SUR001", name: "Laparoscopic Appendectomy" },
    {
      keyword: "cataract",
      code: "OPH001",
      name: "Phacoemulsification with IOL",
    },
    { keyword: "knee", code: "ORT001", name: "Total Knee Replacement" },
    { keyword: "hip", code: "ORT002", name: "Total Hip Replacement" },
    { keyword: "hernia", code: "SUR002", name: "Laparoscopic Hernia Repair" },
    { keyword: "angioplasty", code: "CAR001", name: "PTCA with Stenting" },
    { keyword: "bypass", code: "CAR002", name: "Coronary Artery Bypass Graft" },
    { keyword: "dialysis", code: "NEP001", name: "Hemodialysis" },
    { keyword: "delivery", code: "OBS001", name: "Normal Delivery" },
    {
      keyword: "cesarean",
      code: "OBS002",
      name: "Lower Segment Cesarean Section",
    },
    {
      keyword: "pneumonia",
      code: "MED001",
      name: "Medical Management Pneumonia",
    },
    { keyword: "fracture", code: "ORT003", name: "Fracture Fixation Surgery" },
    {
      keyword: "gallstone",
      code: "SUR003",
      name: "Laparoscopic Cholecystectomy",
    },
    { keyword: "tonsil", code: "ENT001", name: "Tonsillectomy" },
  ];

const DEFAULT_CHECKLIST: DocChecklistItem[] = [
  { docName: "Patient ID Proof", required: true, submitted: false },
  { docName: "Insurance Card / Policy", required: true, submitted: false },
  {
    docName: "Doctor's Prescription / Referral",
    required: true,
    submitted: false,
  },
  {
    docName: "Clinical Notes / Admission Note",
    required: true,
    submitted: false,
  },
  { docName: "Investigation Reports", required: true, submitted: false },
  { docName: "Previous Treatment Records", required: false, submitted: false },
  {
    docName: "Discharge Summary (if re-admission)",
    required: false,
    submitted: false,
  },
];

const STATUS_OPTIONS = ["Approved", "Rejected", "QueryRaised", "Withdrawn"];
const FILTER_STATUSES = [
  "All",
  "Submitted",
  "Approved",
  "Rejected",
  "QueryRaised",
  "Withdrawn",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const d = new Date(ms);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getTatStatus(
  record: PreAuthRecord,
): "ontime" | "warning" | "breached" | "closed" {
  if (["Approved", "Rejected", "Withdrawn"].includes(record.status))
    return "closed";
  const submittedMs = Number(record.submittedAt / 1_000_000n);
  const tatHours = (Date.now() - submittedMs) / 3_600_000;
  const expected = Number(record.expectedTATHours);
  if (tatHours > expected) return "breached";
  if (tatHours > expected * 0.75) return "warning";
  return "ontime";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    Submitted: {
      label: "Submitted",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
    },
    Approved: {
      label: "Approved",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    Rejected: {
      label: "Rejected",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    QueryRaised: {
      label: "Query Raised",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    Withdrawn: {
      label: "Withdrawn",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
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

function TatIcon({
  status,
}: { status: "ontime" | "warning" | "breached" | "closed" }) {
  if (status === "closed")
    return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
  if (status === "breached")
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (status === "warning") return <Clock className="h-4 w-4 text-amber-500" />;
  return <Clock className="h-4 w-4 text-green-500" />;
}

// ---------------------------------------------------------------------------
// Section card (consistent with RCMModule style)
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
// Dashboard Tab
// ---------------------------------------------------------------------------

function DashboardTab({ records }: { records: PreAuthRecord[] }) {
  const total = records.length;
  const approved = records.filter((r) => r.status === "Approved").length;
  const rejected = records.filter((r) => r.status === "Rejected").length;
  const queries = records.filter((r) => r.status === "QueryRaised").length;
  const tatAlerts = records.filter(
    (r) => getTatStatus(r) === "breached",
  ).length;

  const approvalRate =
    approved + rejected > 0
      ? Math.round((approved / (approved + rejected)) * 100)
      : 0;

  const schemeBreakdown = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.schemeType] = (acc[r.schemeType] ?? 0) + 1;
    return acc;
  }, {});

  const recent = [...records]
    .sort((a, b) => Number(b.updatedAt - a.updatedAt))
    .slice(0, 5);

  const stats = [
    {
      label: "Total Pre-Auths",
      value: total,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      label: "Approved",
      value: approved,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Rejected",
      value: rejected,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    {
      label: "Queries Pending",
      value: queries,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "TAT Alerts",
      value: tatAlerts,
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            data-ocid={`preauth.dashboard.card.${i + 1}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "rounded-xl border p-4 flex flex-col gap-1",
              s.bg,
              s.border,
            )}
          >
            <span className="text-xs text-gray-500 font-medium">{s.label}</span>
            <span className={cn("text-3xl font-bold", s.color)}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Approval Rate */}
        <SectionCard
          title="Approval Rate"
          icon={<Activity className="h-4 w-4" />}
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-hp-muted">
                Approved vs Rejected
              </span>
              <span className="text-lg font-bold text-hp-body">
                {approvalRate}%
              </span>
            </div>
            <Progress value={approvalRate} className="h-3 rounded-full" />
            <div className="flex gap-4 text-xs text-hp-muted">
              <span className="text-green-600 font-medium">
                {approved} approved
              </span>
              <span className="text-red-500 font-medium">
                {rejected} rejected
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Scheme Breakdown */}
        <SectionCard
          title="Scheme Breakdown"
          icon={<FileCheck className="h-4 w-4" />}
        >
          {Object.keys(schemeBreakdown).length === 0 ? (
            <p className="text-sm text-hp-muted text-center py-4">
              No data yet
            </p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(schemeBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([scheme, count]) => (
                  <li
                    key={scheme}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-hp-body">{scheme}</span>
                    <span className="font-bold text-hp-blue">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <SectionCard title="Recent Activity" icon={<Clock className="h-4 w-4" />}>
        {recent.length === 0 ? (
          <p
            data-ocid="preauth.dashboard.empty_state"
            className="text-sm text-hp-muted text-center py-4"
          >
            No pre-auth records yet
          </p>
        ) : (
          <ul className="divide-y divide-hp-border">
            {recent.map((r, i) => (
              <li
                key={r.id}
                data-ocid={`preauth.recent.item.${i + 1}`}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-hp-blue truncate">
                    {r.id}
                  </p>
                  <p className="text-sm text-hp-body truncate">
                    {r.patientName}
                  </p>
                </div>
                <StatusBadge status={r.status} />
                <span className="text-xs text-hp-muted whitespace-nowrap hidden sm:block">
                  {formatDateTime(r.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-Auth Card (List Item)
// ---------------------------------------------------------------------------

function PreAuthCard({
  record,
  actor,
  onRefresh,
  onNavigate,
}: {
  record: PreAuthRecord;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFromTPA, setReplyFromTPA] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const tatStatus = getTatStatus(record);

  async function handleSendReply() {
    if (!replyText.trim() || !actor) return;
    setIsSendingReply(true);
    try {
      const ok = await actor.addQueryResponse(
        record.id,
        replyText.trim(),
        replyFromTPA,
      );
      if (ok) {
        toast.success("Response added");
        setReplyText("");
        onRefresh();
      } else {
        toast.error("Failed to add response");
      }
    } catch {
      toast.error("Error sending response");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleSaveStatus() {
    if (!statusUpdate || !actor) return;
    setIsSavingStatus(true);
    try {
      const ok = await actor.updatePreAuthStatus(
        record.id,
        statusUpdate,
        remarks,
      );
      if (ok) {
        toast.success(`Status updated to ${statusUpdate}`);
        setStatusUpdate("");
        setRemarks("");
        onRefresh();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setIsSavingStatus(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-hp-blue text-sm">{record.id}</span>
            <StatusBadge status={record.status} />
            <TatIcon status={tatStatus} />
            {record.status === "QueryRaised" && record.queries.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {record.queries.length} quer
                {record.queries.length === 1 ? "y" : "ies"}
              </Badge>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-hp-muted">
            <span>
              <span className="font-semibold text-hp-body">
                {record.patientName}
              </span>{" "}
              · {record.patientId}
            </span>
            <span>
              <span className="font-semibold text-hp-body">
                {record.packageCode}
              </span>{" "}
              — {record.packageName}
            </span>
            <span>Dx: {record.diagnosisName}</span>
            <span>
              {record.schemeType} · {record.payerName}
            </span>
            <span>Submitted: {formatDateTime(record.submittedAt)}</span>
            <span className="font-semibold text-hp-body">
              ₹{record.requestedAmount}
            </span>
          </div>
          {record.status === "QueryRaised" && record.queries.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200 truncate">
              Latest: "{record.queries[record.queries.length - 1].message}"
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-hp-bg transition-colors text-hp-muted"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Submit Claim shortcut for Approved records */}
      {record.status === "Approved" && onNavigate && (
        <div className="px-5 pb-3">
          <Button
            data-ocid="preauth.submit_claim.button"
            size="sm"
            onClick={() =>
              onNavigate("claims", {
                patientId: record.patientId,
                patientName: record.patientName,
                preAuthId: record.id,
                packageCode: record.packageCode,
                packageName: record.packageName,
                diagnosisName: record.diagnosisName,
                schemeType: record.schemeType,
                payerName: record.payerName,
              })
            }
            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Submit Claim
          </Button>
        </div>
      )}

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-hp-border px-5 py-4 space-y-5">
              {/* Document Checklist */}
              {record.documentChecklist.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-hp-muted mb-2">
                    Document Checklist
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {record.documentChecklist.map((doc) => (
                      <div
                        key={doc.docName}
                        className={cn(
                          "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border",
                          doc.submitted
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-gray-50 border-gray-200 text-gray-500",
                        )}
                      >
                        {doc.submitted ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="flex-1 truncate">{doc.docName}</span>
                        {doc.required && (
                          <span className="text-[10px] text-red-400 font-semibold">
                            REQ
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Query Thread */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-hp-muted mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Query Thread ({record.queries.length})
                </h4>
                {record.queries.length === 0 ? (
                  <p className="text-xs text-hp-muted py-2">No queries yet</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {record.queries.map((q, i) => (
                      <div
                        key={`${record.id}-q-${i}`}
                        className={cn(
                          "text-xs rounded-lg px-3 py-2 max-w-[90%]",
                          q.fromTPA
                            ? "bg-amber-50 border border-amber-200 text-amber-800 ml-auto text-right"
                            : "bg-blue-50 border border-blue-200 text-blue-800",
                        )}
                      >
                        <span className="font-semibold">
                          {q.fromTPA ? "TPA" : "Hospital"}:{" "}
                        </span>
                        {q.message}
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          {formatDateTime(q.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add Response */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Textarea
                      data-ocid="preauth.query.textarea"
                      placeholder="Type a response..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      className="text-xs resize-none"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-hp-muted cursor-pointer">
                      <Checkbox
                        id="preauth-query-tpa"
                        data-ocid="preauth.query.checkbox"
                        checked={replyFromTPA}
                        onCheckedChange={(v) => setReplyFromTPA(!!v)}
                      />
                      <label
                        htmlFor="preauth-query-tpa"
                        className="cursor-pointer"
                      >
                        From TPA
                      </label>
                    </div>
                  </div>
                  <Button
                    data-ocid="preauth.query.send.button"
                    size="sm"
                    disabled={!replyText.trim() || isSendingReply}
                    onClick={handleSendReply}
                    className="bg-hp-blue hover:bg-hp-navy text-white h-9 px-3"
                  >
                    {isSendingReply ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Update Status */}
              <div className="border-t border-hp-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-hp-muted mb-2">
                  Update Status
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                    <SelectTrigger
                      data-ocid="preauth.status.select"
                      className="text-xs h-9 w-full sm:w-44"
                    >
                      <SelectValue placeholder="Change status…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    data-ocid="preauth.status.remarks.textarea"
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={1}
                    className="text-xs resize-none flex-1"
                  />
                  <Button
                    data-ocid="preauth.status.save.button"
                    size="sm"
                    disabled={!statusUpdate || isSavingStatus}
                    onClick={handleSaveStatus}
                    className="bg-hp-blue hover:bg-hp-navy text-white h-9 px-4 shrink-0"
                  >
                    {isSavingStatus ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// List Tab
// ---------------------------------------------------------------------------

function PreAuthListTab({
  records,
  isLoading,
  actor,
  onRefresh,
  onNewPreAuth,
  onNavigate,
}: {
  records: PreAuthRecord[];
  isLoading: boolean;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
  onNewPreAuth: () => void;
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const breachedCount = records.filter(
    (r) => getTatStatus(r) === "breached",
  ).length;

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.patientName.toLowerCase().includes(q) ||
      r.patientId.toLowerCase().includes(q) ||
      r.packageName.toLowerCase().includes(q) ||
      r.diagnosisName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) =>
    Number(b.submittedAt - a.submittedAt),
  );

  return (
    <div className="space-y-4">
      {/* TAT Alert Banner */}
      {breachedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          data-ocid="preauth.tat.error_state"
          className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="font-semibold">
            ⚠ {breachedCount} pre-auth{breachedCount > 1 ? "s" : ""} have
            exceeded TAT — immediate action required
          </span>
        </motion.div>
      )}

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hp-muted pointer-events-none" />
          <input
            data-ocid="preauth.search.input"
            type="text"
            placeholder="Search by patient, package, diagnosis…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm border border-hp-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-hp-blue/30 focus:border-hp-blue/60"
          />
        </div>
        <div className="flex gap-2">
          <Button
            data-ocid="preauth.refresh.button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-9 border-hp-border text-hp-muted hover:text-hp-body"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            data-ocid="preauth.new.button"
            size="sm"
            onClick={onNewPreAuth}
            className="h-9 bg-hp-blue hover:bg-hp-navy text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Pre-Auth
          </Button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-1.5" data-ocid="preauth.filter.tab">
        {FILTER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            data-ocid={`preauth.filter.${s.toLowerCase()}.tab`}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              statusFilter === s
                ? "bg-hp-blue text-white border-hp-blue"
                : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40 hover:text-hp-body",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div
          data-ocid="preauth.list.loading_state"
          className="flex justify-center py-12"
        >
          <Loader2 className="h-6 w-6 animate-spin text-hp-blue" />
        </div>
      ) : sorted.length === 0 ? (
        <div
          data-ocid="preauth.list.empty_state"
          className="text-center py-16 text-hp-muted"
        >
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No pre-auth records found</p>
          <p className="text-xs mt-1">
            Create a new pre-auth request to get started
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {sorted.map((r, i) => (
              <div key={r.id} data-ocid={`preauth.list.item.${i + 1}`}>
                <PreAuthCard
                  record={r}
                  actor={actor}
                  onRefresh={onRefresh}
                  onNavigate={onNavigate}
                />
              </div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Pre-Auth Form (Tab 1)
// ---------------------------------------------------------------------------

interface PreAuthFormState {
  patientId: string;
  patientName: string;
  diagnosisName: string;
  packageCode: string;
  packageName: string;
  schemeType: string;
  payerName: string;
  requestedAmount: string;
  expectedTATHours: string;
  checklist: DocChecklistItem[];
}

const EMPTY_PREAUTH_FORM: PreAuthFormState = {
  patientId: "",
  patientName: "",
  diagnosisName: "",
  packageCode: "",
  packageName: "",
  schemeType: "",
  payerName: "",
  requestedAmount: "",
  expectedTATHours: "48",
  checklist: DEFAULT_CHECKLIST.map((d) => ({ ...d })),
};

function NewPreAuthForm({
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
  const [form, setForm] = useState<PreAuthFormState>(EMPTY_PREAUTH_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof PreAuthFormState, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>(
    [],
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const patientSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [doctors, setDoctors] = useState<DoctorMaster[]>([]);
  const [attendingDoctor, setAttendingDoctor] = useState("");
  const prefillConsumed = useRef(false);

  // Load doctors from masters
  useEffect(() => {
    async function loadDoctors() {
      if (!actor) return;
      try {
        const a = actor as unknown as {
          getDoctors?: () => Promise<DoctorMaster[]>;
        };
        if (typeof a.getDoctors === "function") {
          const docs = await a.getDoctors();
          setDoctors(docs.filter((d) => d.isActive));
        }
      } catch {
        // silently fail - text fallback
      }
    }
    loadDoctors();
  }, [actor]);

  // Consume prefill once
  useEffect(() => {
    if (!prefill || prefillConsumed.current) return;
    const p = prefill as {
      patientId?: string;
      patientName?: string;
      packageCode?: string;
      packageName?: string;
      diagnosisName?: string;
      schemeType?: string;
      payerName?: string;
    };
    if (p.patientId) {
      prefillConsumed.current = true;
      setForm((prev) => ({
        ...prev,
        patientId: p.patientId ?? "",
        patientName: p.patientName ?? "",
        packageCode: p.packageCode ?? "",
        packageName: p.packageName ?? "",
        diagnosisName: p.diagnosisName ?? "",
        schemeType: p.schemeType ?? "",
        payerName: p.payerName ?? "",
      }));
      setPatientFound(true);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const set = (field: keyof PreAuthFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Diagnosis suggestions
  const diagSuggestions =
    form.diagnosisName.trim().length >= 2
      ? DIAGNOSIS_SUGGESTIONS.filter((d) =>
          d.keyword.includes(form.diagnosisName.trim().toLowerCase()),
        )
      : [];

  function selectPatient(p: Patient) {
    setForm((prev) => ({
      ...prev,
      patientId: p.id,
      patientName: p.name,
      payerName: p.payerName || prev.payerName,
      schemeType:
        p.payerType === "Government Scheme"
          ? "Ayushman Bharat"
          : p.payerType === "TPA"
            ? "Private Insurance"
            : p.payerType === "Corporate"
              ? "Corporate"
              : prev.schemeType,
    }));
    setPatientSearchQuery(`${p.name} (${p.id})`);
    setPatientFound(true);
    setShowPatientDropdown(false);
    setPatientSearchResults([]);
  }

  // Click-outside handler for patient dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        patientSearchRef.current &&
        !patientSearchRef.current.contains(e.target as Node)
      ) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handlePatientSearchChange(query: string) {
    setPatientSearchQuery(query);
    if (query.length < 2) {
      setShowPatientDropdown(false);
      setPatientSearchResults([]);
      setPatientFound(false);
      if (patientSearchTimerRef.current)
        clearTimeout(patientSearchTimerRef.current);
      return;
    }
    if (patientSearchTimerRef.current)
      clearTimeout(patientSearchTimerRef.current);
    patientSearchTimerRef.current = setTimeout(async () => {
      if (!actor) return;
      setIsLooking(true);
      try {
        const a = actor as unknown as {
          searchPatients?: (q: string) => Promise<Patient[]>;
        };
        if (typeof a.searchPatients === "function") {
          const results = await a.searchPatients(query);
          setPatientSearchResults(results.slice(0, 8));
          setShowPatientDropdown(results.length > 0);
        }
      } catch {
        // silently fail
      } finally {
        setIsLooking(false);
      }
    }, 300);
  }

  function applySuggestion(code: string, name: string) {
    setForm((prev) => ({ ...prev, packageCode: code, packageName: name }));
  }

  function toggleChecklist(idx: number) {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item, i) =>
        i === idx ? { ...item, submitted: !item.submitted } : item,
      ),
    }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof PreAuthFormState, string>> = {};
    if (!form.patientId.trim()) errs.patientId = "Patient ID is required";
    if (!form.patientName.trim()) errs.patientName = "Patient name is required";
    if (!form.diagnosisName.trim())
      errs.diagnosisName = "Diagnosis is required";
    if (!form.packageCode.trim()) errs.packageCode = "Package code is required";
    if (!form.packageName.trim()) errs.packageName = "Package name is required";
    if (!form.schemeType) errs.schemeType = "Scheme type is required";
    if (!form.payerName.trim()) errs.payerName = "Payer name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !actor) return;
    setIsSubmitting(true);
    try {
      const req: PreAuthRequest = {
        patientId: form.patientId.trim(),
        patientName: form.patientName.trim(),
        packageCode: form.packageCode.trim(),
        packageName: form.packageName.trim(),
        diagnosisName: form.diagnosisName.trim(),
        schemeType: form.schemeType,
        payerName: form.payerName.trim(),
        requestedAmount: form.requestedAmount.trim() || "0",
        expectedTATHours: BigInt(
          Math.max(1, Number.parseInt(form.expectedTATHours) || 48),
        ),
        documentChecklist: form.checklist,
      };
      const result = await actor.createPreAuth(req);
      if ("ok" in result) {
        toast.success(`Pre-Auth created: ${result.ok}`);
        setForm(EMPTY_PREAUTH_FORM);
        setPatientFound(false);
        onSuccess();
      } else {
        toast.error(`Error: ${result.err}`);
      }
    } catch {
      toast.error("Failed to create pre-auth. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const submittedCount = form.checklist.filter((d) => d.submitted).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Patient Lookup */}
      <SectionCard title="Patient Search" icon={<Search className="h-4 w-4" />}>
        <div className="space-y-3">
          <div ref={patientSearchRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                data-ocid="preauth.patient_search.input"
                placeholder="Search by name, ID, or ABHA ID…"
                value={patientSearchQuery}
                onChange={(e) => handlePatientSearchChange(e.target.value)}
                onFocus={() => {
                  if (patientSearchResults.length > 0)
                    setShowPatientDropdown(true);
                }}
                className={cn(
                  "pl-9 pr-9 text-sm",
                  errors.patientId && "border-red-400",
                )}
                autoComplete="off"
              />
              {isLooking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {errors.patientId && (
              <p className="text-xs text-red-500 mt-1">{errors.patientId}</p>
            )}
            <AnimatePresence>
              {showPatientDropdown && patientSearchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-border rounded-lg shadow-lg overflow-hidden"
                >
                  {patientSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-ocid="preauth.patient_search.item"
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 border-b last:border-b-0 border-border/50"
                    >
                      <span className="font-medium text-sm text-foreground">
                        {p.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          {p.id}
                        </span>
                        {p.payerName && <span>{p.payerName}</span>}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {patientFound && (
            <p
              data-ocid="preauth.lookup.success_state"
              className="text-xs text-green-600 flex items-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Patient found — details
              auto-filled
            </p>
          )}
          <FieldRow label="Patient Name" required>
            <Input
              data-ocid="preauth.patient_name.input"
              placeholder="Full name"
              value={form.patientName}
              readOnly={patientFound}
              onChange={(e) =>
                !patientFound && set("patientName", e.target.value)
              }
              className={cn(
                "text-sm",
                errors.patientName && "border-red-400",
                patientFound && "bg-muted/40 cursor-default",
              )}
            />
            {errors.patientName && (
              <p className="text-xs text-red-500">{errors.patientName}</p>
            )}
          </FieldRow>
        </div>
      </SectionCard>

      {/* Clinical Details */}
      <SectionCard
        title="Clinical Details"
        icon={<FileCheck className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <FieldRow label="Diagnosis Name" required>
            <Input
              data-ocid="preauth.diagnosis.input"
              placeholder="e.g. Appendicitis, Cataract"
              value={form.diagnosisName}
              onChange={(e) => set("diagnosisName", e.target.value)}
              className={cn(
                "text-sm",
                errors.diagnosisName && "border-red-400",
              )}
            />
            {errors.diagnosisName && (
              <p className="text-xs text-red-500">{errors.diagnosisName}</p>
            )}
            {/* Package Suggestions */}
            {diagSuggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-hp-muted font-semibold uppercase tracking-wide">
                  Suggested Packages
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {diagSuggestions.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      data-ocid="preauth.suggestion.button"
                      onClick={() => applySuggestion(s.code, s.name)}
                      className="inline-flex items-center gap-1 text-[11px] bg-blue-50 border border-blue-200 text-hp-blue rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors font-medium"
                    >
                      <span className="font-bold">{s.code}</span>
                      <span className="text-blue-500">— {s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FieldRow>
          <div className="grid sm:grid-cols-2 gap-4">
            <FieldRow label="Package Code" required>
              <Input
                data-ocid="preauth.package_code.input"
                placeholder="e.g. SUR001"
                value={form.packageCode}
                onChange={(e) => set("packageCode", e.target.value)}
                className={cn(
                  "text-sm font-mono",
                  errors.packageCode && "border-red-400",
                )}
              />
              {errors.packageCode && (
                <p className="text-xs text-red-500">{errors.packageCode}</p>
              )}
            </FieldRow>
            <FieldRow label="Package Name" required>
              <Input
                data-ocid="preauth.package_name.input"
                placeholder="e.g. Laparoscopic Appendectomy"
                value={form.packageName}
                onChange={(e) => set("packageName", e.target.value)}
                className={cn(
                  "text-sm",
                  errors.packageName && "border-red-400",
                )}
              />
              {errors.packageName && (
                <p className="text-xs text-red-500">{errors.packageName}</p>
              )}
            </FieldRow>
          </div>
        </div>
      </SectionCard>

      {/* Scheme & Payer */}
      <SectionCard
        title="Scheme & Payer"
        icon={<Activity className="h-4 w-4" />}
      >
        <div className="grid sm:grid-cols-3 gap-4">
          <FieldRow label="Scheme Type" required>
            <Select
              value={form.schemeType}
              onValueChange={(v) => set("schemeType", v)}
            >
              <SelectTrigger
                data-ocid="preauth.scheme_type.select"
                className={cn("text-sm", errors.schemeType && "border-red-400")}
              >
                <SelectValue placeholder="Select scheme" />
              </SelectTrigger>
              <SelectContent>
                {[
                  "PMJAY",
                  "Ayushman Bharat",
                  "Private Insurance",
                  "Corporate",
                  "Other",
                ].map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.schemeType && (
              <p className="text-xs text-red-500">{errors.schemeType}</p>
            )}
          </FieldRow>
          <FieldRow label="Payer Name" required>
            <Input
              data-ocid="preauth.payer_name.input"
              placeholder="TPA / Insurer name"
              value={form.payerName}
              onChange={(e) => set("payerName", e.target.value)}
              className={cn("text-sm", errors.payerName && "border-red-400")}
            />
            {errors.payerName && (
              <p className="text-xs text-red-500">{errors.payerName}</p>
            )}
          </FieldRow>
          <FieldRow label="Requested Amount (₹)">
            <Input
              data-ocid="preauth.amount.input"
              placeholder="e.g. 75000"
              value={form.requestedAmount}
              onChange={(e) => set("requestedAmount", e.target.value)}
              className="text-sm"
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* TAT */}
      <SectionCard
        title="TAT Configuration"
        icon={<Clock className="h-4 w-4" />}
      >
        <div className="max-w-xs">
          <FieldRow label="Expected TAT (Hours)">
            <Input
              data-ocid="preauth.tat.input"
              type="number"
              min={1}
              value={form.expectedTATHours}
              onChange={(e) => set("expectedTATHours", e.target.value)}
              className="text-sm"
            />
          </FieldRow>
          <p className="text-xs text-hp-muted mt-1.5">
            Default: 48 hours. Alert triggers if TAT is breached.
          </p>
        </div>
      </SectionCard>

      {/* Attending Doctor */}
      <SectionCard
        title="Attending Doctor"
        icon={<Activity className="h-4 w-4" />}
      >
        <div className="max-w-sm">
          {doctors.length > 0 ? (
            <Select value={attendingDoctor} onValueChange={setAttendingDoctor}>
              <SelectTrigger
                data-ocid="preauth.doctor.select"
                className="text-sm"
              >
                <SelectValue placeholder="Select attending doctor (optional)" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.name} className="text-sm">
                    Dr. {d.name}
                    {d.specialisation ? ` (${d.specialisation})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              data-ocid="preauth.doctor.input"
              placeholder="Attending doctor name (optional)"
              value={attendingDoctor}
              onChange={(e) => setAttendingDoctor(e.target.value)}
              className="text-sm"
            />
          )}
          <p className="text-xs text-hp-muted mt-1.5">
            Optional — auto-populated from Doctor Master if configured.
          </p>
        </div>
      </SectionCard>

      {/* Document Checklist */}
      <SectionCard
        title="Document Checklist"
        icon={<FileCheck className="h-4 w-4" />}
        badge={
          <Badge
            className={cn(
              "text-xs border rounded-full px-2 py-0.5",
              submittedCount === form.checklist.length
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-blue-100 text-blue-700 border-blue-200",
            )}
          >
            {submittedCount}/{form.checklist.length} submitted
          </Badge>
        }
      >
        <div className="grid sm:grid-cols-2 gap-2">
          {form.checklist.map((doc, idx) => (
            <div
              key={doc.docName}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm",
                doc.submitted
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-hp-border hover:border-hp-blue/40",
              )}
            >
              <Checkbox
                id={`preauth-doc-${idx}`}
                data-ocid={`preauth.doc.checkbox.${idx + 1}`}
                checked={doc.submitted}
                onCheckedChange={() => toggleChecklist(idx)}
              />
              <label
                htmlFor={`preauth-doc-${idx}`}
                className={cn(
                  "flex-1 cursor-pointer",
                  doc.submitted ? "text-green-700" : "text-hp-body",
                )}
              >
                {doc.docName}
              </label>
              {doc.required && (
                <span className="text-[10px] text-red-400 font-bold shrink-0">
                  REQ
                </span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button
          data-ocid="preauth.submit.button"
          type="submit"
          disabled={isSubmitting || !actor}
          className="bg-hp-blue hover:bg-hp-navy text-white font-bold px-8 h-11 rounded-xl"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4 mr-2" />
              Submit Pre-Auth Request
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main PreAuthModule
// ---------------------------------------------------------------------------

export function PreAuthModule({
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

  const [activeTab, setActiveTab] = useState("new");
  const [records, setRecords] = useState<PreAuthRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!typedActor) return;
    setIsLoadingRecords(true);
    try {
      const data = await typedActor.getPreAuths();
      setRecords(data);
    } catch {
      toast.error("Failed to load pre-auth records");
    } finally {
      setIsLoadingRecords(false);
    }
  }, [typedActor]);

  useEffect(() => {
    if (typedActor && !isFetching) {
      loadRecords();
    }
  }, [typedActor, isFetching, loadRecords]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "list" || tab === "dashboard") {
      loadRecords();
    }
  }

  function handleNewPreAuthSuccess() {
    setActiveTab("list");
    loadRecords();
  }

  const breachedCount = records.filter(
    (r) => getTatStatus(r) === "breached",
  ).length;

  return (
    <motion.main
      key="preauth"
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
            <FileCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-xl tracking-tight">
                Pre-Authorization Module
              </h1>
              <span className="text-[10px] bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                ⭐ MOST CRITICAL
              </span>
            </div>
            <p className="text-white/70 text-xs mt-0.5">
              Module 2 — Revenue-Critical · PMJAY / Private · ABDM + NABH Ready
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            {breachedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 text-red-200 text-xs rounded-lg px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {breachedCount} TAT breach{breachedCount > 1 ? "es" : ""}
              </div>
            )}
            <div className="text-white/60 text-xs">
              {records.length} record{records.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <WorkflowBanner
          currentStep="preauth"
          onNavigate={(page) => onNavigate?.(page)}
        />
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white border border-hp-border rounded-xl h-10 mb-6 p-1">
            <TabsTrigger
              data-ocid="preauth.new.tab"
              value="new"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Pre-Auth
            </TabsTrigger>
            <TabsTrigger
              data-ocid="preauth.list.tab"
              value="list"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <FileCheck className="h-3.5 w-3.5 mr-1.5" />
              Pre-Auth List
              {records.length > 0 && (
                <span className="ml-1.5 bg-hp-blue/20 text-hp-blue text-[10px] font-bold px-1.5 py-0.5 rounded-full data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {records.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              data-ocid="preauth.dashboard.tab"
              value="dashboard"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-0">
            <NewPreAuthForm
              actor={typedActor}
              onSuccess={handleNewPreAuthSuccess}
              prefill={prefill}
              onPrefillConsumed={onPrefillConsumed}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <PreAuthListTab
              records={records}
              isLoading={isLoadingRecords}
              actor={typedActor}
              onRefresh={loadRecords}
              onNewPreAuth={() => setActiveTab("new")}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab records={records} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.main>
  );
}
