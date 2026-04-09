import type { Appeal, AppealInput, ClaimRecord } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner } from "./WorkflowBanner";

type RejectionCategory = "Technical" | "Medical" | "Policy" | "Other";
type DenialStatus = "Open" | "Resubmitted" | "Resolved" | "WrittenOff";
type AppealStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

const STORAGE_KEY = "rcm_denial_records";
const APPEAL_TAT_DAYS = 7;

interface LocalDenialRecord {
  id: string;
  claimId: string;
  status: DenialStatus;
  rootCauseNotes: string;
  updatedAt: number;
}

function loadLocalDenials(): Map<string, LocalDenialRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as LocalDenialRecord[];
    return new Map(arr.map((d) => [d.claimId, d]));
  } catch {
    return new Map();
  }
}

function saveLocalDenials(map: Map<string, LocalDenialRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
}

function classifyRejection(remarks: string): RejectionCategory {
  const r = remarks.toLowerCase();
  if (
    r.includes("document") ||
    r.includes("missing") ||
    r.includes("format") ||
    r.includes("invalid") ||
    r.includes("incomplete") ||
    r.includes("upload")
  )
    return "Technical";
  if (
    r.includes("medically") ||
    r.includes("not necessary") ||
    r.includes("excluded procedure") ||
    r.includes("clinical") ||
    r.includes("diagnosis") ||
    r.includes("procedure not covered")
  )
    return "Medical";
  if (
    r.includes("policy") ||
    r.includes("lapsed") ||
    r.includes("exclusion") ||
    r.includes("premium") ||
    r.includes("waiting period") ||
    r.includes("scheme")
  )
    return "Policy";
  return "Other";
}

function categoryBadge(cat: RejectionCategory) {
  const map: Record<RejectionCategory, string> = {
    Technical: "bg-orange-100 text-orange-700 border-orange-200",
    Medical: "bg-purple-100 text-purple-700 border-purple-200",
    Policy: "bg-blue-100 text-blue-700 border-blue-200",
    Other: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return map[cat];
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Open: "bg-red-100 text-red-700 border-red-200",
    Resubmitted: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Resolved: "bg-green-100 text-green-700 border-green-200",
    WrittenOff: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
}

function appealStatusBadge(status: AppealStatus) {
  const map: Record<AppealStatus, string> = {
    Draft: "bg-gray-100 text-gray-600 border-gray-200",
    Submitted: "bg-blue-100 text-blue-700 border-blue-200",
    Approved: "bg-green-100 text-green-700 border-green-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return map[status];
}

function fmtTs(ts: bigint | undefined): string {
  if (!ts) return "-";
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-IN");
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN");
}

function daysSince(ts: bigint): number {
  const ms = Number(ts) / 1_000_000;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function isAppealTatBreach(appeal: Appeal): boolean {
  if (appeal.status !== "Submitted") return false;
  const ref = appeal.submittedAt ?? appeal.createdAt;
  return daysSince(ref) > APPEAL_TAT_DAYS;
}

interface EnrichedRejection {
  claim: ClaimRecord;
  denial: LocalDenialRecord | null;
  category: RejectionCategory;
  status: DenialStatus;
  rootCauseNotes: string;
}

interface Props {
  onNavigate: (page: string, data?: Record<string, unknown>) => void;
  onAlertCount?: (count: number) => void;
}

// ---------------------------------------------------------------------------
// AppealPanel — inline per-denial appeal view
// ---------------------------------------------------------------------------

interface AppealPanelProps {
  item: EnrichedRejection;
  actor: ReturnType<typeof useActor>["actor"];
  onRefresh: () => void;
}

function AppealPanel({ item, actor, onRefresh }: AppealPanelProps) {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loadingAppeals, setLoadingAppeals] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealNotes, setAppealNotes] = useState("");
  const [submitAsDraft, setSubmitAsDraft] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAppeals = useCallback(async () => {
    if (!actor) return;
    setLoadingAppeals(true);
    try {
      const denialId = item.denial?.id ?? `denial_${item.claim.id}`;
      const result = (await (actor as any).getAppealsByDenialId(
        denialId,
      )) as Appeal[];
      setAppeals(result);
    } catch {
      setAppeals([]);
    } finally {
      setLoadingAppeals(false);
    }
  }, [actor, item.denial?.id, item.claim.id]);

  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);

  const handleSubmitAppeal = async () => {
    if (!actor || !appealReason.trim()) {
      toast.error("Appeal reason is required");
      return;
    }
    setSubmitting(true);
    try {
      const denialId = item.denial?.id ?? `denial_${item.claim.id}`;
      const input: AppealInput = {
        denialId,
        claimId: item.claim.id,
        patientId: item.claim.patientId,
        appealReason: appealReason.trim(),
        notes: appealNotes.trim(),
        status: submitAsDraft ? "Draft" : "Submitted",
      };
      const result = (await (actor as any).createAppeal(input)) as {
        ok?: Appeal;
        err?: string;
      };
      if (result.err) throw new Error(result.err);
      toast.success(
        submitAsDraft
          ? "Appeal saved as Draft"
          : "Appeal submitted successfully",
      );
      setAppealReason("");
      setAppealNotes("");
      setShowForm(false);
      await loadAppeals();
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create appeal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (appealId: string, newStatus: string) => {
    if (!actor) return;
    setUpdatingId(appealId);
    try {
      const result = (await (actor as any).updateAppealStatus(
        appealId,
        newStatus,
        "",
      )) as { ok?: Appeal; err?: string };
      if (result.err) throw new Error(result.err);
      toast.success(`Appeal ${newStatus}`);
      await loadAppeals();
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update appeal");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-hp-border bg-blue-50/40 rounded-b-xl -mx-4 -mb-4 px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-hp-muted flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Appeal Tracking
          {appeals.length > 0 && (
            <span className="bg-hp-blue text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
              {appeals.length}
            </span>
          )}
        </p>
        <Button
          size="sm"
          variant="outline"
          data-ocid={`appeal.new_form.toggle.${item.claim.id}`}
          onClick={() => setShowForm((v) => !v)}
          className="text-hp-blue border-hp-blue/40 hover:bg-hp-blue hover:text-white text-xs h-7 px-2 gap-1"
        >
          <Plus className="h-3 w-3" />
          New Appeal
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 bg-white border border-hp-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-hp-body mb-1">New Appeal</p>
          <div>
            <label
              htmlFor={`appeal-reason-${item.claim.id}`}
              className="text-[10px] font-bold uppercase tracking-wide text-hp-muted mb-1 block"
            >
              Appeal Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              id={`appeal-reason-${item.claim.id}`}
              data-ocid={`appeal.reason.textarea.${item.claim.id}`}
              placeholder="Describe the grounds for appeal..."
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
          <div>
            <label
              htmlFor={`appeal-notes-${item.claim.id}`}
              className="text-[10px] font-bold uppercase tracking-wide text-hp-muted mb-1 block"
            >
              Supporting Notes
            </label>
            <Textarea
              id={`appeal-notes-${item.claim.id}`}
              data-ocid={`appeal.notes.textarea.${item.claim.id}`}
              placeholder="Additional evidence, documentation references..."
              value={appealNotes}
              onChange={(e) => setAppealNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={submitAsDraft}
                onChange={(e) => setSubmitAsDraft(e.target.checked)}
                className="rounded border-hp-border"
              />
              <span className="text-hp-muted">Save as Draft</span>
            </label>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                data-ocid={`appeal.submit.button.${item.claim.id}`}
                onClick={handleSubmitAppeal}
                disabled={submitting || !appealReason.trim()}
                className="bg-hp-blue text-white hover:bg-hp-navy text-xs h-8"
              >
                {submitting
                  ? "Saving..."
                  : submitAsDraft
                    ? "Save Draft"
                    : "Submit Appeal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadingAppeals ? (
        <p className="text-xs text-hp-muted py-2">Loading appeals...</p>
      ) : appeals.length === 0 ? (
        <p className="text-xs text-hp-muted italic py-2">
          No appeals yet. Click "New Appeal" to file one.
        </p>
      ) : (
        <div className="space-y-2">
          {appeals.map((appeal) => {
            const tatBreach = isAppealTatBreach(appeal);
            const as = appeal.status as AppealStatus;
            return (
              <div
                key={appeal.id}
                data-ocid={`appeal.item.${appeal.id}`}
                className={`bg-white border rounded-lg p-3 ${tatBreach ? "border-amber-300" : "border-hp-border"}`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-hp-muted">
                    #{appeal.id.slice(-6)}
                  </span>
                  <Badge className={`text-[10px] ${appealStatusBadge(as)}`}>
                    {appeal.status}
                  </Badge>
                  {tatBreach && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      TAT Breach (
                      {daysSince(appeal.submittedAt ?? appeal.createdAt)}d)
                    </span>
                  )}
                </div>
                <p className="text-xs text-hp-body leading-relaxed mb-1.5">
                  {appeal.appealReason}
                </p>
                {appeal.notes && (
                  <p className="text-xs text-hp-muted italic mb-1.5">
                    {appeal.notes}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-hp-muted">
                  <span>Filed: {fmtTs(appeal.createdAt)}</span>
                  {appeal.submittedAt && (
                    <span>Submitted: {fmtTs(appeal.submittedAt)}</span>
                  )}
                  {appeal.resolvedAt && (
                    <span>Resolved: {fmtTs(appeal.resolvedAt)}</span>
                  )}
                </div>
                {appeal.status === "Submitted" && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(appeal.id, "Approved")}
                      disabled={updatingId === appeal.id}
                      className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(appeal.id, "Rejected")}
                      disabled={updatingId === appeal.id}
                      className="h-6 px-2 text-[10px] text-red-600 border-red-300"
                    >
                      <XCircle className="h-2.5 w-2.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
                {appeal.status === "Draft" && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(appeal.id, "Submitted")}
                      disabled={updatingId === appeal.id}
                      className="h-6 px-2 text-[10px] bg-hp-blue hover:bg-hp-navy text-white"
                    >
                      Submit Appeal
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DenialModule
// ---------------------------------------------------------------------------

export function DenialModule({ onNavigate, onAlertCount }: Props) {
  const { actor, isFetching } = useActor();
  const [rejections, setRejections] = useState<EnrichedRejection[]>([]);
  const [allAppeals, setAllAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DenialStatus | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appealOpenId, setAppealOpenId] = useState<string | null>(null);
  const [rootNotes, setRootNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [appealSearch, setAppealSearch] = useState("");
  const [appealStatusFilter, setAppealStatusFilter] = useState<
    AppealStatus | "All"
  >("All");

  const buildEnriched = useCallback(
    (claims: ClaimRecord[]) => {
      const denialMap = loadLocalDenials();
      const rejectedClaims = claims.filter((c) => c.status === "Rejected");
      const enriched: EnrichedRejection[] = rejectedClaims.map((claim) => {
        const denial = denialMap.get(claim.id) ?? null;
        const category = classifyRejection(claim.rejectionRemarks);
        const status: DenialStatus = denial ? denial.status : "Open";
        const notes = denial?.rootCauseNotes ?? "";
        return { claim, denial, category, status, rootCauseNotes: notes };
      });
      setRejections(enriched);
      const openCount = enriched.filter((e) => e.status === "Open").length;
      onAlertCount?.(openCount);
      if (openCount > 0) {
        toast.error(
          `⚠️ ${openCount} rejected claim${openCount > 1 ? "s" : ""} require attention`,
          { duration: 5000 },
        );
      }
    },
    [onAlertCount],
  );

  const loadAllAppeals = useCallback(async () => {
    if (!actor) return;
    try {
      const result = (await (actor as any).getAppeals()) as Appeal[];
      setAllAppeals(result ?? []);
    } catch {
      setAllAppeals([]);
    }
  }, [actor]);

  const load = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    try {
      const claims = (await (actor as any).getClaims()) as ClaimRecord[];
      buildEnriched(claims);
      await loadAllAppeals();
    } catch {
      toast.error("Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching, buildEnriched, loadAllAppeals]);

  useEffect(() => {
    if (actor && !isFetching) {
      load();
    }
  }, [actor, isFetching, load]);

  const updateDenialLocally = (
    claimId: string,
    status: DenialStatus,
    notes: string,
  ) => {
    const map = loadLocalDenials();
    const existing = map.get(claimId);
    const record: LocalDenialRecord = {
      id: existing?.id ?? `denial_${claimId}_${Date.now()}`,
      claimId,
      status,
      rootCauseNotes: notes,
      updatedAt: Date.now(),
    };
    map.set(claimId, record);
    saveLocalDenials(map);
  };

  const handleResubmit = async (item: EnrichedRejection) => {
    setSaving((prev) => ({ ...prev, [item.claim.id]: true }));
    try {
      updateDenialLocally(item.claim.id, "Resubmitted", "");
      toast.success("Marked as Resubmitted");
      await load();
      onNavigate("rcm-workflow", {
        preAuthId: item.claim.preAuthId,
        patientId: item.claim.patientId,
        patientName: item.claim.patientName,
        packageCode: item.claim.packageCode,
        packageName: item.claim.packageName,
        payerName: item.claim.payerName,
        schemeType: item.claim.schemeType,
      });
    } catch {
      toast.error("Failed to resubmit");
    } finally {
      setSaving((prev) => ({ ...prev, [item.claim.id]: false }));
    }
  };

  const handleResolve = async (item: EnrichedRejection) => {
    setSaving((prev) => ({ ...prev, [item.claim.id]: true }));
    try {
      const notes = rootNotes[item.claim.id] ?? item.rootCauseNotes;
      updateDenialLocally(item.claim.id, "Resolved", notes);
      toast.success("Marked as Resolved");
      await load();
    } catch {
      toast.error("Failed to resolve");
    } finally {
      setSaving((prev) => ({ ...prev, [item.claim.id]: false }));
    }
  };

  const handleWriteOff = async (item: EnrichedRejection) => {
    setSaving((prev) => ({ ...prev, [item.claim.id]: true }));
    try {
      updateDenialLocally(item.claim.id, "WrittenOff", item.rootCauseNotes);
      toast.success("Marked as Written Off");
      await load();
    } catch {
      toast.error("Failed to write off");
    } finally {
      setSaving((prev) => ({ ...prev, [item.claim.id]: false }));
    }
  };

  const handleSaveNotes = async (item: EnrichedRejection) => {
    setSaving((prev) => ({ ...prev, [item.claim.id]: true }));
    try {
      const notes = rootNotes[item.claim.id] ?? "";
      updateDenialLocally(item.claim.id, item.status, notes);
      toast.success("Notes saved");
      await load();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving((prev) => ({ ...prev, [item.claim.id]: false }));
    }
  };

  // Denial stats
  const totalCount = rejections.length;
  const openCount = rejections.filter((r) => r.status === "Open").length;
  const resubCount = rejections.filter(
    (r) => r.status === "Resubmitted",
  ).length;
  const resolvedCount = rejections.filter(
    (r) => r.status === "Resolved" || r.status === "WrittenOff",
  ).length;

  // Appeal stats
  const totalAppeals = allAppeals.length;
  const approvedAppeals = allAppeals.filter(
    (a) => a.status === "Approved",
  ).length;
  const submittedAppeals = allAppeals.filter(
    (a) => a.status === "Submitted",
  ).length;
  const approvalRate =
    submittedAppeals + approvedAppeals > 0
      ? Math.round(
          (approvedAppeals / (submittedAppeals + approvedAppeals)) * 100,
        )
      : 0;

  const resolvedAppeals = allAppeals.filter(
    (a) => a.resolvedAt && (a.status === "Approved" || a.status === "Rejected"),
  );
  const avgResolutionDays =
    resolvedAppeals.length > 0
      ? Math.round(
          resolvedAppeals.reduce((sum, a) => {
            const submitted = a.submittedAt ?? a.createdAt;
            return (
              sum +
              daysSince(submitted) -
              (a.resolvedAt ? daysSince(a.resolvedAt) : 0)
            );
          }, 0) / resolvedAppeals.length,
        )
      : 0;

  const appealTatBreaches = allAppeals.filter(isAppealTatBreach).length;

  const appealStatusCounts: Record<AppealStatus, number> = {
    Draft: allAppeals.filter((a) => a.status === "Draft").length,
    Submitted: allAppeals.filter((a) => a.status === "Submitted").length,
    Approved: allAppeals.filter((a) => a.status === "Approved").length,
    Rejected: allAppeals.filter((a) => a.status === "Rejected").length,
  };

  const categoryCounts: Record<RejectionCategory, number> = {
    Technical: rejections.filter((r) => r.category === "Technical").length,
    Medical: rejections.filter((r) => r.category === "Medical").length,
    Policy: rejections.filter((r) => r.category === "Policy").length,
    Other: rejections.filter((r) => r.category === "Other").length,
  };

  const reasonMap = new Map<
    string,
    { count: number; category: RejectionCategory }
  >();
  for (const r of rejections) {
    const key =
      r.claim.rejectionRemarks.trim().slice(0, 120) || "No reason given";
    const existing = reasonMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      reasonMap.set(key, { count: 1, category: r.category });
    }
  }
  const topReasons = [...reasonMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  const payerMap = new Map<string, number>();
  for (const r of rejections) {
    payerMap.set(r.claim.payerName, (payerMap.get(r.claim.payerName) ?? 0) + 1);
  }
  const payerBreakdown = [...payerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const schemeMap = new Map<string, number>();
  for (const r of rejections) {
    schemeMap.set(
      r.claim.schemeType,
      (schemeMap.get(r.claim.schemeType) ?? 0) + 1,
    );
  }
  const schemeBreakdown = [...schemeMap.entries()].sort((a, b) => b[1] - a[1]);

  const filtered = rejections.filter((r) => {
    const matchSearch =
      !search ||
      r.claim.patientName.toLowerCase().includes(search.toLowerCase()) ||
      r.claim.id.toLowerCase().includes(search.toLowerCase()) ||
      r.claim.payerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredAppeals = allAppeals.filter((a) => {
    const matchSearch =
      !appealSearch ||
      a.denialId.toLowerCase().includes(appealSearch.toLowerCase()) ||
      a.claimId.toLowerCase().includes(appealSearch.toLowerCase()) ||
      a.patientId.toLowerCase().includes(appealSearch.toLowerCase());
    const matchStatus =
      appealStatusFilter === "All" || a.status === appealStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-hp-bg">
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <WorkflowBanner currentStep="denial" onNavigate={onNavigate} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hp-body flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              Denial &amp; Rejection Management
            </h1>
            <p className="text-sm text-hp-muted mt-0.5">
              Track, classify, resolve, and appeal rejected claims
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            data-ocid="denial.refresh.button"
            className="gap-1"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Alert Banner */}
        {(openCount > 0 || appealTatBreaches > 0) && (
          <div
            data-ocid="denial.alert.panel"
            className="mb-5 flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">
              {openCount > 0 &&
                `${openCount} claim${openCount > 1 ? "s" : ""} require attention`}
              {openCount > 0 && appealTatBreaches > 0 && " · "}
              {appealTatBreaches > 0 && (
                <span className="text-amber-700">
                  {appealTatBreaches} appeal{appealTatBreaches > 1 ? "s" : ""}{" "}
                  past TAT ({APPEAL_TAT_DAYS}d)
                </span>
              )}
            </span>
          </div>
        )}

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-5">
            <TabsTrigger value="dashboard" data-ocid="denial.dashboard.tab">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="records" data-ocid="denial.records.tab">
              Rejection Records
              {openCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="appeals" data-ocid="denial.appeals.tab">
              Appeals
              {totalAppeals > 0 && (
                <span className="ml-2 bg-hp-blue text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {totalAppeals}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------------------- */}
          {/* DASHBOARD TAB                                                     */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="dashboard">
            {loading ? (
              <div
                data-ocid="denial.loading_state"
                className="text-center py-12 text-hp-muted"
              >
                Loading analytics...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Existing denial stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Total Rejections",
                      value: totalCount,
                      color: "text-hp-body",
                    },
                    {
                      label: "Open (Unresolved)",
                      value: openCount,
                      color: "text-red-600",
                    },
                    {
                      label: "Resubmitted",
                      value: resubCount,
                      color: "text-yellow-600",
                    },
                    {
                      label: "Resolved / Written Off",
                      value: resolvedCount,
                      color: "text-green-600",
                    },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardContent className="pt-5 pb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-hp-muted mb-1">
                          {s.label}
                        </p>
                        <p className={`text-3xl font-bold ${s.color}`}>
                          {s.value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Appeal stats cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="border-blue-200 bg-blue-50/40">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">
                        Total Appeals
                      </p>
                      <p className="text-3xl font-bold text-blue-700">
                        {totalAppeals}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50/40">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">
                        Appeal Approval Rate
                      </p>
                      <p className="text-3xl font-bold text-green-700">
                        {approvalRate}%
                      </p>
                      <p className="text-[10px] text-hp-muted mt-0.5">
                        {approvedAppeals} of{" "}
                        {approvedAppeals + submittedAppeals} submitted
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200 bg-amber-50/40">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
                        Avg Resolution Time
                      </p>
                      <p className="text-3xl font-bold text-amber-700">
                        {avgResolutionDays > 0 ? `${avgResolutionDays}d` : "—"}
                      </p>
                      <p className="text-[10px] text-hp-muted mt-0.5">
                        {resolvedAppeals.length} resolved
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Appeals by status mini-row */}
                {totalAppeals > 0 && (
                  <div className="rounded-xl border border-hp-border bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-hp-muted mb-3">
                      Appeals by Status
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(
                        [
                          "Draft",
                          "Submitted",
                          "Approved",
                          "Rejected",
                        ] as AppealStatus[]
                      ).map((s) => (
                        <div
                          key={s}
                          className={`rounded-lg border px-3 py-2.5 text-center ${appealStatusBadge(s)}`}
                        >
                          <p className="text-xs font-semibold mb-0.5">{s}</p>
                          <p className="text-xl font-bold">
                            {appealStatusCounts[s]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category breakdown */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      [
                        "Technical",
                        "bg-orange-50 border-orange-200",
                        "text-orange-700",
                      ],
                      [
                        "Medical",
                        "bg-purple-50 border-purple-200",
                        "text-purple-700",
                      ],
                      ["Policy", "bg-blue-50 border-blue-200", "text-blue-700"],
                      ["Other", "bg-gray-50 border-gray-200", "text-gray-600"],
                    ] as [RejectionCategory, string, string][]
                  ).map(([cat, bg, text]) => (
                    <div key={cat} className={`rounded-xl border p-4 ${bg}`}>
                      <Badge className={`text-xs mb-2 ${categoryBadge(cat)}`}>
                        {cat}
                      </Badge>
                      <p className={`text-2xl font-bold ${text}`}>
                        {categoryCounts[cat]}
                      </p>
                      <p className="text-xs text-hp-muted mt-0.5">rejections</p>
                    </div>
                  ))}
                </div>

                {/* Top Reasons + Payer/Scheme */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Top 10 Rejection Reasons
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topReasons.length === 0 ? (
                        <p className="text-sm text-hp-muted py-4 text-center">
                          No data yet
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-hp-border">
                              <th className="text-left pb-2 text-xs font-semibold text-hp-muted w-6">
                                #
                              </th>
                              <th className="text-left pb-2 text-xs font-semibold text-hp-muted">
                                Reason
                              </th>
                              <th className="text-left pb-2 text-xs font-semibold text-hp-muted w-20">
                                Category
                              </th>
                              <th className="text-right pb-2 text-xs font-semibold text-hp-muted w-10">
                                Count
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {topReasons.map(
                              ([reason, { count, category }], i) => (
                                <tr
                                  key={reason}
                                  className="border-b border-hp-border last:border-0"
                                >
                                  <td className="py-2 text-xs text-hp-muted">
                                    {i + 1}
                                  </td>
                                  <td className="py-2 text-xs text-hp-body pr-3">
                                    {reason.length > 80
                                      ? `${reason.slice(0, 80)}…`
                                      : reason}
                                  </td>
                                  <td className="py-2">
                                    <Badge
                                      className={`text-[10px] ${categoryBadge(category)}`}
                                    >
                                      {category}
                                    </Badge>
                                  </td>
                                  <td className="py-2 text-right font-bold text-hp-blue">
                                    {count}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Rejection by Payer
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {payerBreakdown.length === 0 ? (
                          <p className="text-sm text-hp-muted py-2 text-center">
                            No data yet
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-hp-border">
                                <th className="text-left pb-2 text-xs font-semibold text-hp-muted">
                                  Payer
                                </th>
                                <th className="text-right pb-2 text-xs font-semibold text-hp-muted">
                                  Count
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {payerBreakdown.map(([payer, count]) => (
                                <tr
                                  key={payer}
                                  className="border-b border-hp-border last:border-0"
                                >
                                  <td className="py-1.5 text-xs text-hp-body">
                                    {payer}
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-hp-blue">
                                    {count}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Rejection by Scheme Type
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {schemeBreakdown.length === 0 ? (
                          <p className="text-sm text-hp-muted py-2 text-center">
                            No data yet
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-hp-border">
                                <th className="text-left pb-2 text-xs font-semibold text-hp-muted">
                                  Scheme
                                </th>
                                <th className="text-right pb-2 text-xs font-semibold text-hp-muted">
                                  Count
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {schemeBreakdown.map(([scheme, count]) => (
                                <tr
                                  key={scheme}
                                  className="border-b border-hp-border last:border-0"
                                >
                                  <td className="py-1.5 text-xs text-hp-body">
                                    {scheme}
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-hp-blue">
                                    {count}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* REJECTION RECORDS TAB                                             */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="records">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                data-ocid="denial.search_input"
                placeholder="Search by patient name, claim ID, or payer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    "All",
                    "Open",
                    "Resubmitted",
                    "Resolved",
                    "WrittenOff",
                  ] as const
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-ocid={`denial.filter.${s.toLowerCase()}.tab`}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      statusFilter === s
                        ? "bg-hp-blue text-white border-hp-blue"
                        : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40"
                    }`}
                  >
                    {s === "WrittenOff" ? "Written Off" : s}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div
                data-ocid="denial.records.loading_state"
                className="text-center py-12 text-hp-muted"
              >
                Loading records...
              </div>
            ) : filtered.length === 0 ? (
              <div
                data-ocid="denial.records.empty_state"
                className="text-center py-16 bg-white rounded-xl border border-hp-border"
              >
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-hp-body">
                  No rejection records found
                </p>
                <p className="text-sm text-hp-muted mt-1">
                  {totalCount === 0
                    ? "No rejected claims in the system."
                    : "Try adjusting your search or filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item, idx) => (
                  <div
                    key={item.claim.id}
                    data-ocid={`denial.item.${idx + 1}`}
                    className="bg-white rounded-xl border border-hp-border p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-hp-muted uppercase tracking-wide">
                            {item.claim.id}
                          </span>
                          <Badge
                            className={`text-[10px] ${categoryBadge(item.category)}`}
                          >
                            {item.category}
                          </Badge>
                          <Badge
                            className={`text-[10px] ${statusBadge(item.status)}`}
                          >
                            {item.status === "WrittenOff"
                              ? "Written Off"
                              : item.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-hp-body">
                          {item.claim.patientName}
                        </p>
                        <p className="text-xs text-hp-muted mt-0.5">
                          {item.claim.payerName} &bull; {item.claim.packageCode}{" "}
                          &ndash;{" "}
                          {item.claim.packageName.length > 50
                            ? `${item.claim.packageName.slice(0, 50)}…`
                            : item.claim.packageName}{" "}
                          &bull; {item.claim.schemeType}
                        </p>
                        {item.claim.rejectionRemarks && (
                          <p className="text-xs text-red-600 mt-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                            <span className="font-semibold">Rejection: </span>
                            {item.claim.rejectionRemarks.length > 140
                              ? `${item.claim.rejectionRemarks.slice(0, 140)}…`
                              : item.claim.rejectionRemarks}
                          </p>
                        )}
                        <p className="text-[10px] text-hp-muted mt-1.5">
                          Created: {fmtTs(item.claim.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                        {item.status === "Open" && (
                          <Button
                            size="sm"
                            data-ocid={`denial.resubmit.button.${idx + 1}`}
                            onClick={() => handleResubmit(item)}
                            disabled={saving[item.claim.id]}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs"
                          >
                            Resubmit
                          </Button>
                        )}
                        {(item.status === "Open" ||
                          item.status === "Resubmitted") && (
                          <Button
                            size="sm"
                            variant="outline"
                            data-ocid={`denial.resolve.button.${idx + 1}`}
                            onClick={() => handleResolve(item)}
                            disabled={saving[item.claim.id]}
                            className="text-green-700 border-green-300 hover:bg-green-50 text-xs"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {item.status !== "WrittenOff" &&
                          item.status !== "Resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-ocid={`denial.writeoff.button.${idx + 1}`}
                              onClick={() => handleWriteOff(item)}
                              disabled={saving[item.claim.id]}
                              className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Write Off
                            </Button>
                          )}
                        <button
                          type="button"
                          data-ocid={`denial.appeal.toggle.${idx + 1}`}
                          onClick={() =>
                            setAppealOpenId(
                              appealOpenId === item.claim.id
                                ? null
                                : item.claim.id,
                            )
                          }
                          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                            appealOpenId === item.claim.id
                              ? "bg-hp-blue text-white border-hp-blue"
                              : "text-hp-blue border-hp-blue/40 hover:bg-hp-blue/5"
                          }`}
                        >
                          <FileText className="h-3 w-3" />
                          Appeal
                          {appealOpenId === item.claim.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          data-ocid={`denial.notes.toggle.${idx + 1}`}
                          onClick={() =>
                            setExpandedId(
                              expandedId === item.claim.id
                                ? null
                                : item.claim.id,
                            )
                          }
                          className="text-xs text-hp-blue underline text-left"
                        >
                          {expandedId === item.claim.id
                            ? "Hide Notes"
                            : "Root Cause Notes"}
                        </button>
                      </div>
                    </div>

                    {expandedId === item.claim.id && (
                      <div className="mt-3 pt-3 border-t border-hp-border">
                        <label
                          htmlFor={`root-cause-${item.claim.id}`}
                          className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1 block"
                        >
                          Root Cause Analysis Notes
                        </label>
                        <Textarea
                          id={`root-cause-${item.claim.id}`}
                          data-ocid={`denial.root_cause.textarea.${idx + 1}`}
                          placeholder="Document the root cause, corrective actions taken, and preventive measures..."
                          value={
                            rootNotes[item.claim.id] !== undefined
                              ? rootNotes[item.claim.id]
                              : item.rootCauseNotes
                          }
                          onChange={(e) =>
                            setRootNotes((prev) => ({
                              ...prev,
                              [item.claim.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          data-ocid={`denial.save_notes.button.${idx + 1}`}
                          onClick={() => handleSaveNotes(item)}
                          disabled={saving[item.claim.id]}
                          className="mt-2 bg-hp-blue text-white hover:bg-hp-navy text-xs"
                        >
                          Save Notes
                        </Button>
                      </div>
                    )}

                    {appealOpenId === item.claim.id && actor && (
                      <AppealPanel
                        item={item}
                        actor={actor}
                        onRefresh={loadAllAppeals}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* APPEALS TAB                                                       */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="appeals">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                data-ocid="appeals.search_input"
                placeholder="Search by patient ID, denial ID, or claim ID..."
                value={appealSearch}
                onChange={(e) => setAppealSearch(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-2 flex-wrap">
                {(
                  ["All", "Draft", "Submitted", "Approved", "Rejected"] as const
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-ocid={`appeals.filter.${s.toLowerCase()}.tab`}
                    onClick={() => setAppealStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      appealStatusFilter === s
                        ? "bg-hp-blue text-white border-hp-blue"
                        : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40"
                    }`}
                  >
                    {s}
                    {s !== "All" &&
                      appealStatusCounts[s as AppealStatus] > 0 && (
                        <span className="ml-1 text-[10px] opacity-80">
                          ({appealStatusCounts[s as AppealStatus]})
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-hp-muted">
                Loading appeals...
              </div>
            ) : filteredAppeals.length === 0 ? (
              <div
                data-ocid="appeals.empty_state"
                className="text-center py-16 bg-white rounded-xl border border-hp-border"
              >
                <FileText className="h-10 w-10 text-hp-muted/40 mx-auto mb-3" />
                <p className="font-semibold text-hp-body">No appeals found</p>
                <p className="text-sm text-hp-muted mt-1">
                  {totalAppeals === 0
                    ? "No appeals have been filed yet. Use the Rejection Records tab to file appeals."
                    : "Try adjusting your search or filter."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-hp-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-hp-bg border-b border-hp-border">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted">
                        Appeal ID
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted">
                        Denial / Claim
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted hidden md:table-cell">
                        Patient
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted hidden lg:table-cell">
                        Reason
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted hidden md:table-cell">
                        Filed
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-hp-muted">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppeals.map((appeal, idx) => {
                      const tatBreach = isAppealTatBreach(appeal);
                      const as = appeal.status as AppealStatus;
                      return (
                        <tr
                          key={appeal.id}
                          data-ocid={`appeals.row.${idx + 1}`}
                          className={`border-b border-hp-border last:border-0 hover:bg-hp-bg/60 transition-colors ${tatBreach ? "bg-amber-50/60" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-bold text-hp-muted">
                              #{appeal.id.slice(-8)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-hp-body">
                              {appeal.denialId.slice(-10)}
                            </p>
                            <p className="text-[10px] text-hp-muted">
                              {appeal.claimId.slice(-8)}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-hp-body">
                              {appeal.patientId.slice(-8)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge
                                className={`text-[10px] w-fit ${appealStatusBadge(as)}`}
                              >
                                {appeal.status}
                              </Badge>
                              {tatBreach && (
                                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-600">
                                  <Clock className="h-2.5 w-2.5" />
                                  TAT Breach
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <p
                              className="text-xs text-hp-body max-w-[180px] truncate"
                              title={appeal.appealReason}
                            >
                              {appeal.appealReason.length > 60
                                ? `${appeal.appealReason.slice(0, 60)}…`
                                : appeal.appealReason}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-hp-muted">
                              {fmtDate(Number(appeal.createdAt) / 1_000_000)}
                            </p>
                            {appeal.submittedAt && (
                              <p className="text-[10px] text-hp-muted">
                                Sub: {fmtTs(appeal.submittedAt)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1 justify-end">
                              {appeal.status === "Draft" && (
                                <Button
                                  size="sm"
                                  data-ocid={`appeals.submit.button.${idx + 1}`}
                                  onClick={async () => {
                                    if (!actor) return;
                                    try {
                                      const result = (await (
                                        actor as any
                                      ).updateAppealStatus(
                                        appeal.id,
                                        "Submitted",
                                        "",
                                      )) as { ok?: Appeal; err?: string };
                                      if (result.err)
                                        throw new Error(result.err);
                                      toast.success("Appeal submitted");
                                      await loadAllAppeals();
                                    } catch {
                                      toast.error("Failed to submit appeal");
                                    }
                                  }}
                                  className="h-6 px-2 text-[10px] bg-hp-blue hover:bg-hp-navy text-white"
                                >
                                  Submit
                                </Button>
                              )}
                              {appeal.status === "Submitted" && (
                                <>
                                  <Button
                                    size="sm"
                                    data-ocid={`appeals.approve.button.${idx + 1}`}
                                    onClick={async () => {
                                      if (!actor) return;
                                      try {
                                        await (actor as any).updateAppealStatus(
                                          appeal.id,
                                          "Approved",
                                          "",
                                        );
                                        toast.success("Appeal Approved");
                                        await loadAllAppeals();
                                      } catch {
                                        toast.error("Failed to approve");
                                      }
                                    }}
                                    className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-ocid={`appeals.reject.button.${idx + 1}`}
                                    onClick={async () => {
                                      if (!actor) return;
                                      try {
                                        await (actor as any).updateAppealStatus(
                                          appeal.id,
                                          "Rejected",
                                          "",
                                        );
                                        toast.success("Appeal Rejected");
                                        await loadAllAppeals();
                                      } catch {
                                        toast.error("Failed to reject");
                                      }
                                    }}
                                    className="h-6 px-2 text-[10px] text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
