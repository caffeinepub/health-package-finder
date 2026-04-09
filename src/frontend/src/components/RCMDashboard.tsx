import type {
  AgingAR,
  ClaimRecord,
  PreAuthRecord,
  RCMStats,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileCheck,
  LayoutDashboard,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIndianCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function fmtTs(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KPICardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  accent: string; // Tailwind border-color class
  icon: React.ReactNode;
  alert?: boolean;
}

function KPICard({
  label,
  value,
  subtext,
  trend,
  accent,
  icon,
  alert,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm p-5 flex flex-col gap-2 relative overflow-hidden",
        "hover:shadow-md transition-shadow",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          accent,
        )}
      />
      <div className="flex items-start justify-between gap-2 pl-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "p-1.5 rounded-lg",
            alert ? "bg-red-50 text-red-500" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </div>
      <div className="pl-2">
        <p className="text-2xl font-bold text-foreground leading-tight">
          {value}
        </p>
        {subtext && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            )}
            {trend === "down" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up"
                  ? "text-emerald-600"
                  : trend === "down"
                    ? "text-red-500"
                    : "text-muted-foreground",
              )}
            >
              {subtext}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function KPISkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Pill
// ---------------------------------------------------------------------------

function StatusPill({
  label,
  count,
  color,
}: { label: string; count: number; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
        color,
      )}
    >
      <span className="font-bold text-sm">{count}</span>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Aging AR Bar
// ---------------------------------------------------------------------------

function AgingBucketBar({
  label,
  count,
  total,
  colorClass,
  badgeClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  badgeClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-semibold px-2 py-0.5 rounded-full border text-xs",
            badgeClass,
          )}
        >
          {label}
        </span>
        <span className="font-bold text-foreground">{count} claims</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {pct}% of total
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Activity Feed
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  type: "claim" | "preauth" | "payment";
  label: string;
  patient: string;
  status: string;
  ts: bigint;
}

function activityStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "settled")
    return "bg-green-100 text-green-700 border-green-200";
  if (s === "rejected" || s === "denied")
    return "bg-red-100 text-red-700 border-red-200";
  if (s.includes("pending") || s.includes("submitted"))
    return "bg-amber-100 text-amber-700 border-amber-200";
  if (s.includes("review") || s.includes("underreview"))
    return "bg-blue-100 text-blue-700 border-blue-200";
  if (s === "resubmitted")
    return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-muted text-muted-foreground border-border";
}

function activityTypeIcon(type: ActivityItem["type"]) {
  if (type === "preauth") return <FileCheck className="h-3.5 w-3.5" />;
  if (type === "payment") return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <BarChart3 className="h-3.5 w-3.5" />;
}

function ActivityRow({
  item,
  onNavigate,
}: { item: ActivityItem; onNavigate: (page: string) => void }) {
  return (
    <div
      data-ocid="dashboard.activity_row"
      className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
    >
      <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {activityTypeIcon(item.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {item.label}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.patient} · {fmtTs(item.ts)}
        </p>
      </div>
      <Badge
        className={cn(
          "text-xs border shrink-0 rounded-full",
          activityStatusClass(item.status),
        )}
      >
        {item.status}
      </Badge>
      <button
        type="button"
        data-ocid={`dashboard.activity.view.${item.type}`}
        onClick={() =>
          onNavigate(
            item.type === "preauth"
              ? "preauth"
              : item.type === "payment"
                ? "payment"
                : "claims",
          )
        }
        className="shrink-0 text-xs font-semibold text-hp-blue hover:text-hp-navy flex items-center gap-0.5"
      >
        View <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Links
// ---------------------------------------------------------------------------

function QuickAction({
  label,
  description,
  icon,
  onClick,
  accent,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      data-ocid="dashboard.quick_action"
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-hp-blue/30 transition-all text-left w-full group"
    >
      <div className={cn("mt-0.5 p-2 rounded-lg shrink-0", accent)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-hp-blue transition-colors">
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-hp-blue shrink-0 mt-1 ml-auto transition-colors" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

interface Props {
  onNavigate: (page: string) => void;
}

export function RCMDashboard({ onNavigate }: Props) {
  const { actor, isFetching } = useActor();
  const [stats, setStats] = useState<RCMStats | null>(null);
  const [aging, setAging] = useState<AgingAR | null>(null);
  const [recentClaims, setRecentClaims] = useState<ClaimRecord[]>([]);
  const [recentPreAuths, setRecentPreAuths] = useState<PreAuthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    try {
      const [s, ar, claims, preAuths] = await Promise.all([
        actor.getRCMStats(),
        actor.getAgingAR(),
        actor.getClaims(),
        actor.getPreAuths(),
      ]);
      setStats(s);
      setAging(ar);
      setRecentClaims(
        [...claims]
          .sort((a, b) => Number(b.createdAt - a.createdAt))
          .slice(0, 6),
      );
      setRecentPreAuths(
        [...preAuths]
          .sort((a, b) => Number(b.submittedAt - a.submittedAt))
          .slice(0, 4),
      );
    } catch {
      // silently fail — backend may not be available
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching]);

  useEffect(() => {
    load();
  }, [load]);

  // Build activity feed from claims + preauths
  const activityItems: ActivityItem[] = [
    ...recentClaims.map((c) => ({
      id: c.id,
      type: "claim" as const,
      label: c.packageName || `Claim #${c.id.slice(-6)}`,
      patient: c.patientName,
      status: c.status,
      ts: c.createdAt,
    })),
    ...recentPreAuths.map((p) => ({
      id: p.id,
      type: "preauth" as const,
      label: p.packageName || `Pre-Auth #${p.id.slice(-6)}`,
      patient: p.patientName,
      status: p.status,
      ts: p.submittedAt,
    })),
  ]
    .sort((a, b) => Number(b.ts - a.ts))
    .slice(0, 10);

  const claimsStatusMap = Object.fromEntries(
    (stats?.claimsByStatus ?? []).map(([k, v]) => [k, Number(v)]),
  );

  const denialRateColor =
    (stats?.denialRate ?? 0) > 20
      ? "bg-red-500"
      : (stats?.denialRate ?? 0) > 10
        ? "bg-amber-400"
        : "bg-emerald-500";

  const totalAgingClaims =
    (aging?.bucket0to30.length ?? 0) +
    (aging?.bucket31to60.length ?? 0) +
    (aging?.bucket61to90.length ?? 0) +
    (aging?.bucket91plus.length ?? 0);

  const collectionPct =
    stats && stats.totalClaimsValue > 0
      ? Math.round((stats.totalPaidValue / stats.totalClaimsValue) * 100)
      : 0;

  return (
    <div className="flex-1 bg-muted/30 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-hp-blue" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              RCM Analytics Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Revenue Cycle Performance Overview
            </p>
          </div>
        </div>
        <Button
          data-ocid="dashboard.refresh.button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => load()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-hp-navy rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-3">
          RCM Workflow Pipeline
        </p>
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: "Patient Intake", key: "rcm", color: "bg-blue-600/80" },
            {
              label: "Pre-Authorization",
              key: "preauth",
              color: "bg-indigo-600/80",
            },
            {
              label: "Claims Management",
              key: "claims",
              color: "bg-purple-600/80",
            },
            {
              label: "Payment Collection",
              key: "payment",
              color: "bg-teal-600/80",
            },
          ].map((step, i) => (
            <button
              key={step.key}
              type="button"
              data-ocid={`dashboard.pipeline.${step.key}`}
              onClick={() => onNavigate(step.key)}
              className={cn(
                "relative text-white text-sm font-semibold py-3 px-4 rounded-lg text-center transition-all hover:brightness-110 hover:shadow-lg",
                step.color,
                i > 0 &&
                  "before:absolute before:-left-0.5 before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[14px] before:border-y-transparent before:border-l-[10px] before:border-l-hp-navy",
              )}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          [
            "kpi-ar",
            "kpi-approval",
            "kpi-denial",
            "kpi-resolution",
            "kpi-preauth",
          ].map((k) => <KPISkeleton key={k} />)
        ) : (
          <>
            <KPICard
              label="Total AR Outstanding"
              value={stats ? formatIndianCurrency(stats.totalAR) : "₹0"}
              subtext="Accounts receivable"
              trend="neutral"
              accent="bg-hp-blue"
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <KPICard
              label="Claim Approval Rate"
              value={stats ? `${stats.approvalRate.toFixed(1)}%` : "0%"}
              subtext={
                stats && stats.approvalRate >= 80
                  ? "Above target (80%)"
                  : "Below target (80%)"
              }
              trend={stats && stats.approvalRate >= 80 ? "up" : "down"}
              accent="bg-emerald-500"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KPICard
              label="Claim Denial Rate"
              value={stats ? `${stats.denialRate.toFixed(1)}%` : "0%"}
              subtext={
                (stats?.denialRate ?? 0) > 20
                  ? "Critical — action needed"
                  : (stats?.denialRate ?? 0) > 10
                    ? "Elevated — monitor closely"
                    : "Within acceptable range"
              }
              trend={(stats?.denialRate ?? 0) > 10 ? "down" : "up"}
              accent={denialRateColor}
              alert={(stats?.denialRate ?? 0) > 20}
              icon={<XCircle className="h-4 w-4" />}
            />
            <KPICard
              label="Avg Resolution Time"
              value={stats ? `${stats.avgResolutionDays.toFixed(1)} days` : "—"}
              subtext="Target: ≤30 days"
              trend={(stats?.avgResolutionDays ?? 0) <= 30 ? "up" : "down"}
              accent="bg-indigo-500"
              icon={<Clock className="h-4 w-4" />}
            />
            <KPICard
              label="Pending Pre-Auths"
              value={stats ? Number(stats.pendingPreAuths).toString() : "0"}
              subtext={
                Number(stats?.pendingPreAuths ?? 0) > 10
                  ? "High volume — review TAT"
                  : "Normal queue"
              }
              trend="neutral"
              accent={
                Number(stats?.pendingPreAuths ?? 0) > 10
                  ? "bg-amber-400"
                  : "bg-sky-500"
              }
              alert={Number(stats?.pendingPreAuths ?? 0) > 10}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Row 2: Claims Status + Collection Performance + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Claims by Status */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-hp-blue" /> Claims by Status
          </h3>
          {loading ? (
            <div className="flex flex-wrap gap-2">
              {["s-sub", "s-rev", "s-app", "s-set", "s-rej"].map((k) => (
                <Skeleton key={k} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          ) : Object.keys(claimsStatusMap).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No claims data available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[
                {
                  key: "Submitted",
                  color: "bg-amber-100 text-amber-700 border-amber-200",
                },
                {
                  key: "UnderReview",
                  color: "bg-blue-100 text-blue-700 border-blue-200",
                },
                {
                  key: "Approved",
                  color: "bg-emerald-100 text-emerald-700 border-emerald-200",
                },
                {
                  key: "Settled",
                  color: "bg-teal-100 text-teal-700 border-teal-200",
                },
                {
                  key: "Rejected",
                  color: "bg-red-100 text-red-700 border-red-200",
                },
                {
                  key: "Resubmitted",
                  color: "bg-purple-100 text-purple-700 border-purple-200",
                },
              ]
                .filter((s) => claimsStatusMap[s.key] !== undefined)
                .map((s) => (
                  <StatusPill
                    key={s.key}
                    label={s.key}
                    count={claimsStatusMap[s.key] ?? 0}
                    color={s.color}
                  />
                ))}
            </div>
          )}

          {/* Collection bar */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-muted-foreground">
                Collection Rate
              </span>
              <span className="font-bold text-foreground">
                {loading ? "—" : `${collectionPct}%`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: loading ? "0%" : `${collectionPct}%` }}
              />
            </div>
            {!loading && stats && (
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span>
                  Billed: {formatIndianCurrency(stats.totalClaimsValue)}
                </span>
                <span>Paid: {formatIndianCurrency(stats.totalPaidValue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Aging AR */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" /> Aging AR Buckets
          </h3>
          {loading ? (
            <div className="space-y-4">
              {["ar-0", "ar-31", "ar-61", "ar-91"].map((k) => (
                <Skeleton key={k} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : !aging || totalAgingClaims === 0 ? (
            <p className="text-xs text-muted-foreground">
              No aging AR data. All claims are current.
            </p>
          ) : (
            <div className="space-y-4">
              <AgingBucketBar
                label="0–30 Days"
                count={aging.bucket0to30.length}
                total={totalAgingClaims}
                colorClass="bg-emerald-500"
                badgeClass="bg-green-50 text-green-700 border-green-200"
              />
              <AgingBucketBar
                label="31–60 Days"
                count={aging.bucket31to60.length}
                total={totalAgingClaims}
                colorClass="bg-amber-400"
                badgeClass="bg-yellow-50 text-yellow-700 border-yellow-200"
              />
              <AgingBucketBar
                label="61–90 Days"
                count={aging.bucket61to90.length}
                total={totalAgingClaims}
                colorClass="bg-orange-500"
                badgeClass="bg-orange-50 text-orange-700 border-orange-200"
              />
              <AgingBucketBar
                label="91+ Days"
                count={aging.bucket91plus.length}
                total={totalAgingClaims}
                colorClass="bg-red-500"
                badgeClass="bg-red-50 text-red-700 border-red-200"
              />
            </div>
          )}
          {!loading && aging && aging.totalOutstanding > 0 && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Total outstanding:{" "}
              <strong className="text-foreground">
                {formatIndianCurrency(aging.totalOutstanding)}
              </strong>
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-hp-blue" /> Quick Actions
          </h3>
          <div className="space-y-2.5">
            <QuickAction
              label="View Open Denials"
              description="Review & resubmit rejected claims"
              icon={<XCircle className="h-4 w-4 text-red-500" />}
              accent="bg-red-50"
              onClick={() => onNavigate("denial")}
            />
            <QuickAction
              label="View TAT Breaches"
              description="Pre-auths exceeding turnaround time"
              icon={<Clock className="h-4 w-4 text-amber-500" />}
              accent="bg-amber-50"
              onClick={() => onNavigate("preauth")}
            />
            <QuickAction
              label="View Aging AR"
              description="Outstanding 61+ day claims"
              icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
              accent="bg-orange-50"
              onClick={() => onNavigate("claims")}
            />
            <QuickAction
              label="Register New Patient"
              description="Start the RCM workflow"
              icon={<FileCheck className="h-4 w-4 text-hp-blue" />}
              accent="bg-blue-50"
              onClick={() => onNavigate("rcm")}
            />
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-hp-blue" /> Recent Activity
            <span className="text-xs text-muted-foreground font-normal">
              (last 10 actions)
            </span>
          </h3>
          <button
            type="button"
            data-ocid="dashboard.activity.view_all"
            onClick={() => onNavigate("claims")}
            className="text-xs font-semibold text-hp-blue hover:text-hp-navy flex items-center gap-0.5"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {["act-1", "act-2", "act-3", "act-4", "act-5"].map((k) => (
              <div key={k} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-48 mb-1" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : activityItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">No activity yet</p>
            <p className="text-xs mt-1">
              Start by registering a patient to begin the RCM workflow.
            </p>
            <Button
              data-ocid="dashboard.empty.start_rcm"
              size="sm"
              className="mt-3 bg-hp-blue text-white hover:bg-hp-navy"
              onClick={() => onNavigate("rcm")}
            >
              Register First Patient
            </Button>
          </div>
        ) : (
          <div>
            {activityItems.map((item) => (
              <ActivityRow
                key={`${item.type}-${item.id}`}
                item={item}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
