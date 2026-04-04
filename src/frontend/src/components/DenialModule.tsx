import type { ClaimRecord } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner } from "./WorkflowBanner";

type RejectionCategory = "Technical" | "Medical" | "Policy" | "Other";
type DenialStatus = "Open" | "Resubmitted" | "Resolved" | "WrittenOff";

const STORAGE_KEY = "rcm_denial_records";

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

function fmtTs(ts: bigint | undefined): string {
  if (!ts) return "-";
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-IN");
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

export function DenialModule({ onNavigate, onAlertCount }: Props) {
  const { actor, isFetching } = useActor();
  const [rejections, setRejections] = useState<EnrichedRejection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DenialStatus | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rootNotes, setRootNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
          `\u26a0\ufe0f ${openCount} rejected claim${
            openCount > 1 ? "s" : ""
          } require attention`,
          { duration: 5000 },
        );
      }
    },
    [onAlertCount],
  );

  const load = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    try {
      const claims = (await (actor as any).getClaims()) as ClaimRecord[];
      buildEnriched(claims);
    } catch {
      toast.error("Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching, buildEnriched]);

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
      onNavigate("claims", {
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

  const totalCount = rejections.length;
  const openCount = rejections.filter((r) => r.status === "Open").length;
  const resubCount = rejections.filter(
    (r) => r.status === "Resubmitted",
  ).length;
  const resolvedCount = rejections.filter(
    (r) => r.status === "Resolved" || r.status === "WrittenOff",
  ).length;

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
              Track, classify, and resolve rejected claims
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

        {openCount > 0 && (
          <div
            data-ocid="denial.alert.panel"
            className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">
              {openCount} claim{openCount > 1 ? "s" : ""} require attention
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
          </TabsList>

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
                                      ? `${reason.slice(0, 80)}\u2026`
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
                            ? `${item.claim.packageName.slice(0, 50)}\u2026`
                            : item.claim.packageName}{" "}
                          &bull; {item.claim.schemeType}
                        </p>
                        {item.claim.rejectionRemarks && (
                          <p className="text-xs text-red-600 mt-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                            <span className="font-semibold">Rejection: </span>
                            {item.claim.rejectionRemarks.length > 140
                              ? `${item.claim.rejectionRemarks.slice(0, 140)}\u2026`
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
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
