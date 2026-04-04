import type { ClaimRecord } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentRecord {
  id: string;
  claimId: string;
  patientId: string;
  patientName: string;
  payerName: string;
  billedAmount: string;
  approvedAmount: string;
  paidAmount: string;
  paymentMode: string;
  transactionRef: string;
  paymentDate: string;
  settlementStatus: string;
  discrepancyRemarks: string;
  reconciledAt: bigint;
  createdAt: bigint;
  updatedAt: bigint;
}

type BackendWithPayment = {
  getClaims(): Promise<ClaimRecord[]>;
  createPayment(req: {
    claimId: string;
    patientId: string;
    patientName: string;
    payerName: string;
    billedAmount: string;
    approvedAmount: string;
    paidAmount: string;
    paymentMode: string;
    transactionRef: string;
    paymentDate: string;
    discrepancyRemarks: string;
  }): Promise<{ ok: string } | { err: string }>;
  getPayments(): Promise<PaymentRecord[]>;
  updatePaymentStatus(
    id: string,
    settlementStatus: string,
    paidAmount: string,
    transactionRef: string,
    discrepancyRemarks: string,
  ): Promise<boolean>;
};

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

function formatCurrency(val: string): string {
  const n = Number.parseFloat(val);
  if (Number.isNaN(n)) return val || "\u2014";
  return `\u20b9${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function parseAmount(val: string): number {
  const n = Number.parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

const PAYMENT_STATUSES = [
  "All",
  "Pending",
  "PartiallyPaid",
  "Paid",
  "Disputed",
  "WrittenOff",
];

// ---------------------------------------------------------------------------
// Payment Status Badge
// ---------------------------------------------------------------------------

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    Pending: {
      label: "Pending",
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    PartiallyPaid: {
      label: "Partially Paid",
      cls: "bg-orange-100 text-orange-700 border-orange-200",
    },
    Paid: {
      label: "Paid",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    Disputed: {
      label: "Disputed",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    WrittenOff: {
      label: "Written Off",
      cls: "bg-gray-100 text-gray-500 border-gray-200",
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

// ---------------------------------------------------------------------------
// Section Card + Field Row
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
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-hp-border p-4 flex items-start gap-3">
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          color ?? "bg-hp-blue/10 text-hp-blue",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-hp-muted font-medium">{label}</p>
        <p className="text-lg font-bold text-hp-body leading-tight truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-hp-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: New Payment
// ---------------------------------------------------------------------------

function NewPaymentTab({
  actor,
  prefill,
  onPrefillConsumed,
}: {
  actor: BackendWithPayment;
  prefill?: Record<string, unknown>;
  onPrefillConsumed?: () => void;
}) {
  const [claimSearch, setClaimSearch] = useState("");
  const [matchedClaim, setMatchedClaim] = useState<ClaimRecord | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const prefillConsumed = useRef(false);

  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [discrepancyRemarks, setDiscrepancyRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    actor.getClaims().then((c) => {
      setClaims(c);
      setClaimsLoaded(true);
    });
  }, [actor]);

  // Consume prefill: auto-populate claimSearch and run lookup
  useEffect(() => {
    if (!prefill || prefillConsumed.current) return;
    const p = prefill as {
      claimId?: string;
      patientId?: string;
      patientName?: string;
      payerName?: string;
      billedAmount?: string;
      approvedAmount?: string;
    };
    if (!p.claimId) return;
    prefillConsumed.current = true;
    setClaimSearch(p.claimId);
    onPrefillConsumed?.();
  }, [prefill, onPrefillConsumed]);

  // Auto-run lookup when claimSearch is set from prefill and claims are loaded
  useEffect(() => {
    if (!claimsLoaded || !claimSearch.trim()) return;
    const found = claims.find(
      (c) => c.id.toLowerCase() === claimSearch.trim().toLowerCase(),
    );
    if (found && !matchedClaim) {
      setMatchedClaim(found);
    }
  }, [claimsLoaded, claims, claimSearch, matchedClaim]);

  const handleLookup = useCallback(() => {
    const q = claimSearch.trim().toLowerCase();
    if (!q) return;
    setLookupLoading(true);
    setLookupError("");
    setMatchedClaim(null);
    const found = claims.find(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q),
    );
    setLookupLoading(false);
    if (found) {
      setMatchedClaim(found);
    } else {
      setLookupError(
        claimsLoaded
          ? "No claim found with that ID or patient name."
          : "Claims still loading, try again.",
      );
    }
  }, [claimSearch, claims, claimsLoaded]);

  const showDiscrepancy =
    matchedClaim &&
    paidAmount &&
    Math.abs(
      parseAmount(paidAmount) - parseAmount(matchedClaim.approvedAmount),
    ) > 0.01;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!matchedClaim) e.claimId = "Please look up a claim first.";
    if (!paidAmount || Number.isNaN(Number(paidAmount)))
      e.paidAmount = "Valid paid amount is required.";
    if (!paymentMode) e.paymentMode = "Payment mode is required.";
    if (!paymentDate) e.paymentDate = "Payment date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !matchedClaim) return;
    setSubmitting(true);
    try {
      const res = await actor.createPayment({
        claimId: matchedClaim.id,
        patientId: matchedClaim.patientId,
        patientName: matchedClaim.patientName,
        payerName: matchedClaim.payerName,
        billedAmount: matchedClaim.billedAmount,
        approvedAmount: matchedClaim.approvedAmount,
        paidAmount,
        paymentMode,
        transactionRef,
        paymentDate,
        discrepancyRemarks,
      });
      if ("ok" in res) {
        toast.success(`Payment recorded! ID: ${res.ok}`);
        setMatchedClaim(null);
        setClaimSearch("");
        setPaidAmount("");
        setPaymentMode("");
        setTransactionRef("");
        setPaymentDate("");
        setDiscrepancyRemarks("");
        setErrors({});
      } else {
        toast.error(res.err);
      }
    } catch {
      toast.error("Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Claim Lookup */}
      <SectionCard title="Claim Lookup" icon={<Search className="h-4 w-4" />}>
        <div className="space-y-4">
          <FieldRow label="Search by Claim ID or Patient Name" required>
            <div className="flex gap-2">
              <Input
                data-ocid="payment.claim_search.input"
                placeholder="e.g. CLM-001 or Ramesh Kumar"
                value={claimSearch}
                onChange={(e) => {
                  setClaimSearch(e.target.value);
                  setLookupError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="flex-1 text-sm"
              />
              <Button
                data-ocid="payment.lookup.button"
                type="button"
                onClick={handleLookup}
                className="bg-hp-blue text-white hover:bg-hp-navy"
                disabled={lookupLoading || !claimSearch.trim()}
              >
                {lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Lookup</span>
              </Button>
            </div>
            {errors.claimId && (
              <p
                data-ocid="payment.claim.error_state"
                className="text-xs text-red-500"
              >
                {errors.claimId}
              </p>
            )}
            {lookupError && (
              <p className="text-xs text-red-500">{lookupError}</p>
            )}
          </FieldRow>

          {matchedClaim && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-hp-bg rounded-lg border border-hp-border"
            >
              {[
                ["Patient Name", matchedClaim.patientName],
                ["Payer", matchedClaim.payerName],
                ["Billed Amount", formatCurrency(matchedClaim.billedAmount)],
                [
                  "Approved Amount",
                  formatCurrency(matchedClaim.approvedAmount),
                ],
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <p className="text-xs text-hp-muted">{lbl}</p>
                  <p className="text-sm font-semibold text-hp-body">{val}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </SectionCard>

      {/* Payment Details */}
      <SectionCard
        title="Payment Details"
        icon={<CreditCard className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Paid Amount (₹)" required>
            <Input
              data-ocid="payment.paid_amount.input"
              type="number"
              min="0"
              placeholder="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="text-sm"
            />
            {errors.paidAmount && (
              <p
                data-ocid="payment.paid_amount.error_state"
                className="text-xs text-red-500"
              >
                {errors.paidAmount}
              </p>
            )}
          </FieldRow>

          <FieldRow label="Payment Mode" required>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger
                data-ocid="payment.mode.select"
                className="text-sm"
              >
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {["NEFT", "Cheque", "Online", "Cash"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMode && (
              <p
                data-ocid="payment.mode.error_state"
                className="text-xs text-red-500"
              >
                {errors.paymentMode}
              </p>
            )}
          </FieldRow>

          <FieldRow label="Transaction Reference">
            <Input
              data-ocid="payment.transaction_ref.input"
              placeholder="UTR / Cheque No / Reference"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="text-sm"
            />
          </FieldRow>

          <FieldRow label="Payment Date" required>
            <Input
              data-ocid="payment.date.input"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="text-sm"
            />
            {errors.paymentDate && (
              <p
                data-ocid="payment.date.error_state"
                className="text-xs text-red-500"
              >
                {errors.paymentDate}
              </p>
            )}
          </FieldRow>
        </div>

        {showDiscrepancy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4"
          >
            <FieldRow label="Discrepancy Remarks">
              <Textarea
                data-ocid="payment.discrepancy.textarea"
                placeholder="Explain the difference between approved and paid amount..."
                value={discrepancyRemarks}
                onChange={(e) => setDiscrepancyRemarks(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </FieldRow>
            <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Paid amount differs from approved amount by{" "}
              {formatCurrency(
                String(
                  Math.abs(
                    parseAmount(paidAmount) -
                      parseAmount(matchedClaim!.approvedAmount),
                  ),
                ),
              )}
            </p>
          </motion.div>
        )}

        <div className="mt-5 flex justify-end">
          <Button
            data-ocid="payment.submit.button"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-hp-blue text-white hover:bg-hp-navy font-semibold px-6"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {submitting ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </SectionCard>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Payment Tracker
// ---------------------------------------------------------------------------

function PaymentTrackerTab({ actor }: { actor: BackendWithPayment }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateForms, setUpdateForms] = useState<
    Record<
      string,
      {
        status: string;
        paidAmount: string;
        transactionRef: string;
        discrepancyRemarks: string;
        saving: boolean;
      }
    >
  >({});

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actor.getPayments();
      setPayments(data);
    } catch {
      toast.error("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.patientName.toLowerCase().includes(q) ||
      p.claimId.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "All" || p.settlementStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const getForm = (p: PaymentRecord) =>
    updateForms[p.id] ?? {
      status: p.settlementStatus,
      paidAmount: p.paidAmount,
      transactionRef: p.transactionRef,
      discrepancyRemarks: p.discrepancyRemarks,
      saving: false,
    };

  const setForm = (
    id: string,
    patch: Partial<(typeof updateForms)[string]>,
  ) => {
    setUpdateForms((prev) => ({
      ...prev,
      [id]: { ...getForm(payments.find((p) => p.id === id)!), ...patch },
    }));
  };

  const handleSave = async (id: string) => {
    const form = getForm(payments.find((p) => p.id === id)!);
    setForm(id, { saving: true });
    try {
      const ok = await actor.updatePaymentStatus(
        id,
        form.status,
        form.paidAmount,
        form.transactionRef,
        form.discrepancyRemarks,
      );
      if (ok) {
        toast.success("Payment status updated.");
        await loadPayments();
        setUpdateForms((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        toast.error("Update failed.");
      }
    } catch {
      toast.error("Update failed.");
    } finally {
      setForm(id, { saving: false });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Filters */}
      <div className="bg-white rounded-xl border border-hp-border p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hp-muted" />
          <Input
            data-ocid="payment.tracker.search_input"
            placeholder="Search by patient name or claim ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Button
          data-ocid="payment.tracker.refresh.button"
          type="button"
          variant="outline"
          onClick={loadPayments}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          <span className="ml-1.5 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Status Pills */}
      <div className="flex gap-2 flex-wrap">
        {PAYMENT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            data-ocid={"payment.filter.tab"}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
              statusFilter === s
                ? "bg-hp-blue text-white border-hp-blue"
                : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40",
            )}
          >
            {s === "PartiallyPaid"
              ? "Partially Paid"
              : s === "WrittenOff"
                ? "Written Off"
                : s}
          </button>
        ))}
      </div>

      {/* Payment Cards */}
      {loading ? (
        <div
          data-ocid="payment.tracker.loading_state"
          className="flex items-center justify-center py-12"
        >
          <Loader2 className="h-6 w-6 animate-spin text-hp-blue" />
          <span className="ml-2 text-hp-muted text-sm">
            Loading payments...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-ocid="payment.tracker.empty_state"
          className="bg-white rounded-xl border border-hp-border p-12 text-center"
        >
          <Wallet className="h-10 w-10 text-hp-muted/40 mx-auto mb-3" />
          <p className="font-semibold text-hp-body">No payments found</p>
          <p className="text-sm text-hp-muted mt-1">
            {search || statusFilter !== "All"
              ? "Try adjusting your filters."
              : "Record your first payment using the New Payment tab."}
          </p>
        </div>
      ) : (
        <div data-ocid="payment.tracker.list" className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((p, idx) => {
              const isOpen = expandedId === p.id;
              const form = getForm(p);
              return (
                <motion.div
                  key={p.id}
                  data-ocid={`payment.tracker.item.${idx + 1}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="bg-white rounded-xl border border-hp-border overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-hp-body text-sm">
                          {p.patientName}
                        </p>
                        <p className="text-xs text-hp-muted mt-0.5">
                          {p.id} &bull; Claim: {p.claimId} &bull; {p.payerName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PaymentStatusBadge status={p.settlementStatus} />
                        <button
                          type="button"
                          data-ocid={`payment.tracker.toggle.${idx + 1}`}
                          onClick={() => setExpandedId(isOpen ? null : p.id)}
                          className="text-hp-muted hover:text-hp-body transition-colors"
                        >
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Amount row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["Billed", p.billedAmount],
                        ["Approved", p.approvedAmount],
                        ["Paid", p.paidAmount],
                      ].map(([lbl, val]) => (
                        <div
                          key={lbl}
                          className="bg-hp-bg rounded-lg px-3 py-2 text-center"
                        >
                          <p className="text-xs text-hp-muted">{lbl}</p>
                          <p className="text-sm font-bold text-hp-body">
                            {formatCurrency(val)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hp-muted">
                      <span>
                        Mode:{" "}
                        <span className="text-hp-body font-medium">
                          {p.paymentMode || "\u2014"}
                        </span>
                      </span>
                      {p.transactionRef && (
                        <span>
                          Ref:{" "}
                          <span className="text-hp-body font-medium">
                            {p.transactionRef}
                          </span>
                        </span>
                      )}
                      <span>
                        Date:{" "}
                        <span className="text-hp-body font-medium">
                          {p.paymentDate || "\u2014"}
                        </span>
                      </span>
                      {p.createdAt > 0n && (
                        <span>Recorded: {formatDateTime(p.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Update Section */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        key="expand"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-hp-border p-4 bg-hp-bg/40">
                          <p className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-3">
                            Update Status
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FieldRow label="Settlement Status">
                              <Select
                                value={form.status}
                                onValueChange={(v) =>
                                  setForm(p.id, { status: v })
                                }
                              >
                                <SelectTrigger
                                  data-ocid={"payment.tracker.status.select"}
                                  className="text-sm"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[
                                    "Pending",
                                    "PartiallyPaid",
                                    "Paid",
                                    "Disputed",
                                    "WrittenOff",
                                  ].map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s === "PartiallyPaid"
                                        ? "Partially Paid"
                                        : s === "WrittenOff"
                                          ? "Written Off"
                                          : s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FieldRow>

                            <FieldRow label="Updated Paid Amount (₹)">
                              <Input
                                data-ocid="payment.tracker.update_amount.input"
                                type="number"
                                min="0"
                                value={form.paidAmount}
                                onChange={(e) =>
                                  setForm(p.id, {
                                    paidAmount: e.target.value,
                                  })
                                }
                                className="text-sm"
                              />
                            </FieldRow>

                            <FieldRow label="Transaction Reference">
                              <Input
                                data-ocid="payment.tracker.update_ref.input"
                                value={form.transactionRef}
                                onChange={(e) =>
                                  setForm(p.id, {
                                    transactionRef: e.target.value,
                                  })
                                }
                                className="text-sm"
                              />
                            </FieldRow>

                            <FieldRow label="Discrepancy Remarks">
                              <Textarea
                                data-ocid="payment.tracker.update_remarks.textarea"
                                value={form.discrepancyRemarks}
                                onChange={(e) =>
                                  setForm(p.id, {
                                    discrepancyRemarks: e.target.value,
                                  })
                                }
                                rows={2}
                                className="text-sm resize-none"
                              />
                            </FieldRow>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              data-ocid="payment.tracker.save.button"
                              type="button"
                              onClick={() => handleSave(p.id)}
                              disabled={form.saving}
                              className="bg-hp-blue text-white hover:bg-hp-navy text-sm"
                            >
                              {form.saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : null}
                              {form.saving ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Settlement Dashboard
// ---------------------------------------------------------------------------

function SettlementDashboard({ actor }: { actor: BackendWithPayment }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actor.getPayments();
      setPayments(data);
    } catch {
      toast.error("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // KPIs
  const totalBilled = payments.reduce(
    (sum, p) => sum + parseAmount(p.billedAmount),
    0,
  );
  const totalApproved = payments.reduce(
    (sum, p) => sum + parseAmount(p.approvedAmount),
    0,
  );
  const totalPaid = payments.reduce(
    (sum, p) => sum + parseAmount(p.paidAmount),
    0,
  );
  const outstanding = Math.max(0, totalApproved - totalPaid);
  const disputedAmt = payments
    .filter((p) => p.settlementStatus === "Disputed")
    .reduce((sum, p) => sum + parseAmount(p.paidAmount), 0);
  const settlementRate =
    totalApproved > 0 ? Math.min(100, (totalPaid / totalApproved) * 100) : 0;

  // Payer Breakdown
  const payerMap = new Map<
    string,
    { count: number; billed: number; paid: number }
  >();
  for (const p of payments) {
    const existing = payerMap.get(p.payerName) ?? {
      count: 0,
      billed: 0,
      paid: 0,
    };
    payerMap.set(p.payerName, {
      count: existing.count + 1,
      billed: existing.billed + parseAmount(p.billedAmount),
      paid: existing.paid + parseAmount(p.paidAmount),
    });
  }
  const payerRows = Array.from(payerMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Recent settlements
  const recent = [...payments]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, 10);

  if (loading) {
    return (
      <div
        data-ocid="payment.dashboard.loading_state"
        className="flex items-center justify-center py-16"
      >
        <Loader2 className="h-6 w-6 animate-spin text-hp-blue" />
        <span className="ml-2 text-hp-muted text-sm">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* KPI Cards */}
      <div
        data-ocid="payment.dashboard.section"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <StatCard
          label="Total Billed"
          value={formatCurrency(String(totalBilled))}
          icon={<Banknote className="h-4 w-4" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Total Approved"
          value={formatCurrency(String(totalApproved))}
          icon={<TrendingUp className="h-4 w-4" />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Total Paid"
          value={formatCurrency(String(totalPaid))}
          icon={<Wallet className="h-4 w-4" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(String(outstanding))}
          sub={"Approved - Paid"}
          icon={<AlertCircle className="h-4 w-4" />}
          color={
            outstanding > 0
              ? "bg-amber-50 text-amber-600"
              : "bg-green-50 text-green-600"
          }
        />
        <StatCard
          label="Disputed Amount"
          value={formatCurrency(String(disputedAmt))}
          icon={<BarChart3 className="h-4 w-4" />}
          color={
            disputedAmt > 0
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-400"
          }
        />
      </div>

      {/* Settlement Rate */}
      <div className="bg-white rounded-xl border border-hp-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-hp-body text-sm">
            Settlement Rate
          </h3>
          <span className="text-lg font-bold text-hp-blue">
            {settlementRate.toFixed(1)}%
          </span>
        </div>
        <Progress
          data-ocid="payment.settlement_rate.panel"
          value={settlementRate}
          className="h-3"
        />
        <p className="mt-2 text-xs text-hp-muted">
          {formatCurrency(String(totalPaid))} paid of{" "}
          {formatCurrency(String(totalApproved))} approved across{" "}
          {payments.length} payments
        </p>
      </div>

      {/* Payer Breakdown */}
      <div className="bg-white rounded-xl border border-hp-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hp-border bg-gradient-to-r from-hp-bg to-white flex items-center gap-2">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-hp-blue/10 text-hp-blue">
            <BarChart3 className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-hp-body text-sm">
            Payer Breakdown
          </h3>
        </div>
        {payerRows.length === 0 ? (
          <div
            data-ocid="payment.payer_breakdown.empty_state"
            className="p-8 text-center text-hp-muted text-sm"
          >
            No payer data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-ocid="payment.payer_breakdown.table"
              className="w-full text-sm"
            >
              <thead>
                <tr className="border-b border-hp-border bg-hp-bg/40">
                  {[
                    "Payer Name",
                    "Claims",
                    "Total Billed",
                    "Total Paid",
                    "Rate %",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-hp-muted uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payerRows.map((row, i) => {
                  const rate =
                    row.billed > 0
                      ? ((row.paid / row.billed) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={row.name}
                      data-ocid={`payment.payer_breakdown.row.${i + 1}`}
                      className="border-b border-hp-border last:border-0 hover:bg-hp-bg/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-hp-body">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-hp-muted">{row.count}</td>
                      <td className="px-4 py-3 text-hp-body">
                        {formatCurrency(String(row.billed))}
                      </td>
                      <td className="px-4 py-3 text-hp-body">
                        {formatCurrency(String(row.paid))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "font-semibold",
                            Number(rate) >= 90
                              ? "text-green-600"
                              : Number(rate) >= 50
                                ? "text-amber-600"
                                : "text-red-500",
                          )}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Settlements */}
      <div className="bg-white rounded-xl border border-hp-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hp-border bg-gradient-to-r from-hp-bg to-white flex items-center gap-2">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-hp-blue/10 text-hp-blue">
            <CreditCard className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-hp-body text-sm">
            Recent Settlements
          </h3>
          <span className="ml-auto text-xs text-hp-muted">Last 10</span>
        </div>
        {recent.length === 0 ? (
          <div
            data-ocid="payment.recent.empty_state"
            className="p-8 text-center text-hp-muted text-sm"
          >
            No settlements yet.
          </div>
        ) : (
          <div
            data-ocid="payment.recent.list"
            className="divide-y divide-hp-border"
          >
            {recent.map((p, idx) => (
              <div
                key={p.id}
                data-ocid={`payment.recent.item.${idx + 1}`}
                className="px-5 py-3 flex items-center gap-3 hover:bg-hp-bg/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-hp-body truncate">
                    {p.patientName}
                  </p>
                  <p className="text-xs text-hp-muted truncate">
                    {p.claimId} &bull;{" "}
                    {p.paymentDate || formatDateTime(p.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-hp-body">
                    {formatCurrency(p.paidAmount)}
                  </p>
                  <div className="mt-0.5">
                    <PaymentStatusBadge status={p.settlementStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main PaymentModule
// ---------------------------------------------------------------------------

export function PaymentModule({
  onNavigate,
  prefill,
  onPrefillConsumed,
}: {
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
  prefill?: Record<string, unknown>;
  onPrefillConsumed?: () => void;
} = {}) {
  const { actor, isFetching } = useActor();

  if (isFetching || !actor) {
    return (
      <div
        data-ocid="payment.loading_state"
        className="flex items-center justify-center py-24"
      >
        <Loader2 className="h-6 w-6 animate-spin text-hp-blue mr-2" />
        <span className="text-hp-muted">Loading Payment Module...</span>
      </div>
    );
  }

  const typedActor = actor as unknown as BackendWithPayment;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 py-6 px-4"
    >
      <div className="max-w-screen-lg mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-hp-blue/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-hp-blue" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-hp-body">
                Module 5: Payment & Settlement
              </h1>
              <p className="text-xs text-hp-muted">
                Track payments, update settlement status, and monitor payer-wise
                collections
              </p>
            </div>
          </div>
        </div>

        <WorkflowBanner
          currentStep="payment"
          onNavigate={(page) => onNavigate?.(page)}
        />

        <Tabs defaultValue="new-payment" className="space-y-5">
          <TabsList className="bg-white border border-hp-border rounded-xl p-1 h-auto gap-1">
            <TabsTrigger
              data-ocid="payment.new_payment.tab"
              value="new-payment"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              New Payment
            </TabsTrigger>
            <TabsTrigger
              data-ocid="payment.tracker.tab"
              value="tracker"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              Payment Tracker
            </TabsTrigger>
            <TabsTrigger
              data-ocid="payment.dashboard.tab"
              value="dashboard"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Settlement Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new-payment">
            <NewPaymentTab
              actor={typedActor}
              prefill={prefill}
              onPrefillConsumed={onPrefillConsumed}
            />
          </TabsContent>
          <TabsContent value="tracker">
            <PaymentTrackerTab actor={typedActor} />
          </TabsContent>
          <TabsContent value="dashboard">
            <SettlementDashboard actor={typedActor} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
