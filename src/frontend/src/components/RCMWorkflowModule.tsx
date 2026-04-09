import type {
  ClinicalDocChecklistItem,
  DocChecklistItem,
  DoctorMaster,
  IcdMaster,
  Patient,
  PreAuthRecord,
  TpaMaster,
  WardMaster,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  FileCheck,
  FileText,
  Loader2,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Stethoscope,
  Trash2,
  Upload,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface HealthPackage {
  packageCode: string;
  packageName: string;
  speciality: string;
  category: string;
  rate: number;
  procedureType: string;
  preAuthDocument: string;
  claimDocument: string;
  packageDetails: string;
  specialCondition: string;
  twoHrFlag: string;
  govtReserve: string;
  rtaFlag: string;
  implantPackage: string;
}

type WorkflowMode = "surgical" | "medical" | "multi";
type StepStatus = "pending" | "active" | "complete";

interface WorkflowStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  status: StepStatus;
}

interface UploadedFile {
  name: string;
  size: number;
  docLabel: string;
  dataUrl: string;
}

interface WorkflowState {
  mode: WorkflowMode | null;
  currentStep: number;
  // Step 1
  patientId: string;
  patientData: Patient | null;
  // Step 2
  packageCodes: string[];
  selectedPackages: HealthPackage[];
  diagnosisCodes: string[];
  diagnosisName: string;
  schemeType: string;
  attendingDoctorId: string;
  attendingDoctorName: string;
  tatHours: number;
  wardId: string;
  expectedLOS: number;
  preAuthId: string;
  // Step 3
  clinicalDocId: string;
  docChecklist: ClinicalDocChecklistItem[];
  uploadedFiles: Record<string, UploadedFile>;
  doctorNotes: string;
  dischargeSummary: string;
  // Step 4
  claimId: string;
  claimAmount: string;
  claimRemarks: string;
  // Meta
  completedSteps: number[];
  savedAt?: number;
}

const STORAGE_KEY = "rcm_workflow_state_v2";

const defaultState: WorkflowState = {
  mode: null,
  currentStep: 0,
  patientId: "",
  patientData: null,
  packageCodes: [],
  selectedPackages: [],
  diagnosisCodes: [],
  diagnosisName: "",
  schemeType: "",
  attendingDoctorId: "",
  attendingDoctorName: "",
  tatHours: 48,
  wardId: "",
  expectedLOS: 3,
  preAuthId: "",
  clinicalDocId: "",
  docChecklist: [],
  uploadedFiles: {},
  doctorNotes: "",
  dischargeSummary: "",
  claimId: "",
  claimAmount: "",
  claimRemarks: "",
  completedSteps: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDocs(val: string): string[] {
  if (!val || val.toLowerCase() === "no" || val.toLowerCase() === "none")
    return [];
  return val
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SURGICAL_STANDARD_DOCS = [
  "Pre USG/CT Reports with Film",
  "Post Op HPE Report / HPE Request Form / Removed Sample Photo",
  "Clear Operative Notes",
  "Dr-Patient Photos",
  "Anesthesia Notes",
  "Pre-Anesthesia Checkup Notes",
  "Intra OT Photos (Patient Face + Post-Op Scar Marks)",
  "Discharge Summary",
];

const MEDICAL_STANDARD_DOCS = [
  "Dr Prescription (Complaints, Vitals, Seal & Sign, All TID)",
  "Day-wise ABG / Chest X-ray / CBC / LFT / RFT Reports",
  "Post Treatment Blood Report / Chest X-ray with Film",
  "Dr-Patient Photos",
  "ICU Chart (Vitals, GCS, O₂ Saturation)",
  "Complete Day-wise ICPS with Seal & Sign",
  "Day-wise ICU Photos (Patient Face)",
  "Discharge Summary",
  "CT / MRI / HPE Report with Film",
  "HbsAg Report (Hepatitis Cases)",
];

function buildDocChecklist(
  pkgs: HealthPackage[],
  mode: WorkflowMode,
): ClinicalDocChecklistItem[] {
  const seen = new Set<string>();
  const items: ClinicalDocChecklistItem[] = [];

  const standardDocs =
    mode === "medical" ? MEDICAL_STANDARD_DOCS : SURGICAL_STANDARD_DOCS;

  for (const doc of standardDocs) {
    if (!seen.has(doc)) {
      seen.add(doc);
      items.push({
        docName: doc,
        docType: "standard",
        required: true,
        submitted: false,
        packageCode: "ALL",
      });
    }
  }

  for (const pkg of pkgs) {
    const preAuthDocs = parseDocs(pkg.preAuthDocument);
    const claimDocs = parseDocs(pkg.claimDocument);
    const allDocs = [...new Set([...preAuthDocs, ...claimDocs])];
    for (const doc of allDocs) {
      if (!seen.has(doc)) {
        seen.add(doc);
        items.push({
          docName: doc,
          docType: "package",
          required: true,
          submitted: false,
          packageCode: pkg.packageCode,
        });
      }
    }
  }

  return items;
}

function formatRate(rate: number) {
  return `₹${rate.toLocaleString("en-IN")}`;
}

function getStepStatus(
  stepId: number,
  currentStep: number,
  completedSteps: number[],
): StepStatus {
  if (completedSteps.includes(stepId)) return "complete";
  if (stepId === currentStep) return "active";
  return "pending";
}

// ─── Mode Cards ───────────────────────────────────────────────────────────────

const MODE_CONFIGS: {
  mode: WorkflowMode;
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  badgeText: string;
  description: string;
  bullets: string[];
}[] = [
  {
    mode: "surgical",
    icon: Stethoscope,
    label: "Quick Surgical",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeColor: "bg-blue-100 text-blue-700",
    badgeText: "Surgical Track",
    description:
      "For operative procedures — PTCA, CABG, laparoscopic surgeries, orthopedic implants, and all OT-based cases.",
    bullets: [
      "8-item surgical document checklist",
      "OT photo & HPE report tracking",
      "Pre-anesthesia & intra-OT validation",
    ],
  },
  {
    mode: "medical",
    icon: Activity,
    label: "Quick Medical",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    badgeColor: "bg-teal-100 text-teal-700",
    badgeText: "Medical Management",
    description:
      "For conservative / ICU-based management — pneumonia, hepatitis, renal failure, cardiac conditions without surgery.",
    bullets: [
      "10-item medical management checklist",
      "Day-wise ICU chart & ABG tracking",
      "Ward/Room selection with LOS",
    ],
  },
  {
    mode: "multi",
    icon: Zap,
    label: "Advanced Multi-Package",
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    badgeColor: "bg-violet-100 text-violet-700",
    badgeText: "Multi-Package",
    description:
      "For complex cases requiring multiple packages — combined surgical + diagnostic, implant + procedure, multi-specialty care.",
    bullets: [
      "Unlimited package codes",
      "Deduplicated combined checklist",
      "Per-package document tagging",
    ],
  },
];

// ─── Step Stepper ────────────────────────────────────────────────────────────

function WorkflowStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  patientName,
  mode,
}: {
  steps: WorkflowStep[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepId: number) => void;
  patientName?: string;
  mode: WorkflowMode | null;
}) {
  const progress = (completedSteps.length / steps.length) * 100;
  const modeConfig = MODE_CONFIGS.find((m) => m.mode === mode);

  return (
    <div className="bg-white border-b border-hp-border shadow-sm px-4 py-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          {modeConfig && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                modeConfig.bgColor,
                modeConfig.borderColor,
                modeConfig.color,
              )}
            >
              <modeConfig.icon className="h-3.5 w-3.5" />
              {modeConfig.badgeText}
            </span>
          )}
          {patientName && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-hp-body">
              <User className="h-3.5 w-3.5 text-hp-muted" />
              {patientName}
            </span>
          )}
        </div>
        <span className="text-xs text-hp-muted font-medium">
          Step {Math.min(currentStep + 1, steps.length)} of {steps.length} —{" "}
          {Math.round(progress)}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-hp-border rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-hp-blue to-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((step) => {
          const status = getStepStatus(step.id, currentStep, completedSteps);
          const maxCompleted =
            completedSteps.length > 0 ? Math.max(...completedSteps) : -1;
          const isClickable = step.id <= maxCompleted + 1;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "relative rounded-xl border-2 p-3 text-left transition-all duration-200 group",
                status === "active" && "border-hp-blue bg-blue-50 shadow-md",
                status === "complete" &&
                  "border-emerald-300 bg-emerald-50 cursor-pointer hover:border-emerald-400 hover:shadow-md",
                status === "pending" &&
                  "border-hp-border bg-hp-bg opacity-60 cursor-not-allowed",
              )}
              data-ocid={`workflow.step.${step.id}.button`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    status === "active" && "bg-hp-blue text-white",
                    status === "complete" && "bg-emerald-500 text-white",
                    status === "pending" && "bg-hp-border text-hp-muted",
                  )}
                >
                  {status === "complete" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    step.id + 1
                  )}
                </div>
                <Badge
                  className={cn(
                    "text-[10px] font-semibold rounded-full py-0 px-1.5 shrink-0 border",
                    status === "active" &&
                      "bg-blue-100 text-blue-700 border-blue-200",
                    status === "complete" &&
                      "bg-emerald-100 text-emerald-700 border-emerald-200",
                    status === "pending" &&
                      "bg-hp-border text-hp-muted border-transparent",
                  )}
                >
                  {status === "active"
                    ? "In Progress"
                    : status === "complete"
                      ? "Complete"
                      : "Pending"}
                </Badge>
              </div>
              <p
                className={cn(
                  "text-xs font-bold leading-tight",
                  status === "active"
                    ? "text-hp-blue"
                    : status === "complete"
                      ? "text-emerald-700"
                      : "text-hp-muted",
                )}
              >
                {step.title}
              </p>
              <p className="text-[10px] text-hp-muted mt-0.5 leading-tight line-clamp-1">
                {step.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Patient Lookup ───────────────────────────────────────────────────

function Step1PatientLookup({
  state,
  onUpdate,
  onNavigate,
  onComplete,
}: {
  state: WorkflowState;
  onUpdate: (patch: Partial<WorkflowState>) => void;
  onNavigate: (tab: string) => void;
  onComplete: () => void;
}) {
  const { actor, isFetching } = useActor();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    async (q: string) => {
      if (q.length < 2 || !actor) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await actor.searchPatients(q);
        setResults(res);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [actor],
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 350);
  };

  const selectPatient = (p: Patient) => {
    onUpdate({ patientId: p.id, patientData: p, schemeType: p.payerType });
    setQuery(p.name);
    setShowDropdown(false);
    toast.success(`Patient "${p.name}" selected`);
  };

  const clearPatient = () => {
    onUpdate({ patientId: "", patientData: null });
    setQuery("");
  };

  const patient = state.patientData;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-hp-body mb-1">Patient Lookup</h2>
        <p className="text-sm text-hp-muted">
          Search registered patients by name or ABHA ID. All details auto-fill.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hp-muted" />
          <input
            data-ocid="workflow.patient.search"
            type="text"
            placeholder="Search patient name or ABHA ID…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="w-full pl-9 pr-10 py-2.5 text-sm border border-hp-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-hp-blue/30 focus:border-hp-blue transition"
            disabled={isFetching}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-hp-muted" />
          )}
          {patient && !searching && (
            <button
              type="button"
              onClick={clearPatient}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-hp-muted hover:text-hp-body"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-hp-border shadow-lg overflow-hidden">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPatient(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hp-bg transition-colors text-left border-b border-hp-border last:border-0"
              >
                <div className="h-9 w-9 rounded-full bg-hp-blue/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-hp-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-hp-body">{p.name}</p>
                  <p className="text-xs text-hp-muted">
                    {p.abhaId} · {p.gender} · {p.dob}
                  </p>
                </div>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  {p.payerType}
                </Badge>
              </button>
            ))}
          </div>
        )}
        {showDropdown &&
          results.length === 0 &&
          query.length >= 2 &&
          !searching && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-hp-border shadow-lg p-4 text-center">
              <p className="text-sm text-hp-muted">
                No patients found.{" "}
                <button
                  type="button"
                  onClick={() => onNavigate("rcm")}
                  className="text-hp-blue font-semibold underline"
                >
                  Register new patient →
                </button>
              </p>
            </div>
          )}
      </div>

      {/* Selected patient card */}
      {patient && (
        <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <User className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-hp-body text-base">
                  {patient.name}
                </p>
                <p className="text-xs text-hp-muted">
                  ABHA: {patient.abhaId || "—"}
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              Registered
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Gender", value: patient.gender },
              { label: "DOB", value: patient.dob },
              { label: "Phone", value: patient.phone || "—" },
              { label: "Payer Type", value: patient.payerType },
              { label: "Payer / TPA", value: patient.payerName || "—" },
              { label: "Policy No.", value: patient.policyNumber || "—" },
            ].map((f) => (
              <div key={f.label} className="bg-hp-bg rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-hp-muted mb-0.5">
                  {f.label}
                </p>
                <p className="text-xs font-semibold text-hp-body truncate">
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => onNavigate("rcm")}
          className="text-xs text-hp-blue underline font-medium flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Register New Patient
        </button>
        <Button
          data-ocid="workflow.step1.continue"
          disabled={!patient}
          onClick={onComplete}
          className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl px-6"
        >
          Continue to Package & Pre-Auth
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Package Search ───────────────────────────────────────────────────────────

function PackageSearchPanel({
  packages,
  mode,
  selectedCodes,
  onAdd,
  onRemove,
  multi,
}: {
  packages: HealthPackage[];
  mode: WorkflowMode;
  selectedCodes: string[];
  onAdd: (pkg: HealthPackage) => void;
  onRemove: (code: string) => void;
  multi: boolean;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const search = q.toLowerCase();
    return packages
      .filter((p) => {
        const matchesSearch =
          !search ||
          p.packageName.toLowerCase().includes(search) ||
          p.packageCode.toLowerCase().includes(search) ||
          p.speciality.toLowerCase().includes(search);
        if (mode === "surgical")
          return (
            matchesSearch && !p.procedureType.toLowerCase().includes("medical")
          );
        if (mode === "medical")
          return (
            matchesSearch &&
            (p.procedureType.toLowerCase().includes("medical") ||
              p.procedureType.toLowerCase().includes("management"))
          );
        return matchesSearch;
      })
      .slice(0, 30);
  }, [packages, q, mode]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted" />
        <input
          data-ocid="workflow.package.search"
          type="text"
          placeholder="Search package name, code or speciality…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-8 pr-4 py-2 text-sm border border-hp-border rounded-lg bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 focus:border-hp-blue transition"
        />
      </div>
      <ScrollArea className="h-64 rounded-xl border border-hp-border bg-hp-bg">
        <div className="space-y-2 p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-hp-muted">
              No packages found for this search.
            </div>
          ) : (
            filtered.map((pkg) => {
              const isSelected = selectedCodes.includes(pkg.packageCode);
              return (
                <button
                  key={pkg.packageCode}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3 border transition-all cursor-pointer w-full text-left",
                    isSelected
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-hp-border bg-white hover:border-hp-blue/40 hover:bg-blue-50/30",
                  )}
                  onClick={() =>
                    !isSelected
                      ? onAdd(pkg)
                      : multi && onRemove(pkg.packageCode)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-hp-muted uppercase">
                        {pkg.packageCode}
                      </span>
                      <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 rounded-full py-0">
                        {pkg.procedureType.replace(/[\[\]]/g, "")}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-hp-body line-clamp-1">
                      {pkg.packageName}
                    </p>
                    <p className="text-[10px] text-hp-muted">
                      {pkg.speciality}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-hp-blue">
                      {formatRate(pkg.rate)}
                    </p>
                    {isSelected ? (
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        ✓ Added
                      </span>
                    ) : (
                      <span className="text-[10px] text-hp-muted">
                        Click to add
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Step 2: Package & Pre-Auth ───────────────────────────────────────────────

function Step2PackagePreAuth({
  state,
  allPackages,
  onUpdate,
  onComplete,
}: {
  state: WorkflowState;
  allPackages: HealthPackage[];
  onUpdate: (patch: Partial<WorkflowState>) => void;
  onComplete: () => void;
}) {
  const { actor, isFetching } = useActor();
  const [doctors, setDoctors] = useState<DoctorMaster[]>([]);
  const [icds, setIcds] = useState<IcdMaster[]>([]);
  const [wards, setWards] = useState<WardMaster[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [preAuthError, setPreAuthError] = useState<string | null>(null);
  const [icdQuery, setIcdQuery] = useState("");
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);
  const multi = state.mode === "multi";

  useEffect(() => {
    if (!actor || isFetching) return;
    Promise.all([actor.getDoctors(), actor.getIcds(), actor.getWards()])
      .then(([d, i, w]) => {
        setDoctors(d.filter((x) => x.isActive));
        setIcds(i.filter((x) => x.isActive));
        setWards(w.filter((x) => x.isActive));
      })
      .catch(() => {});
  }, [actor, isFetching]);

  const filteredIcds = useMemo(() => {
    const q = icdQuery.toLowerCase();
    return icds
      .filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [icds, icdQuery]);

  const addPackage = (pkg: HealthPackage) => {
    if (!multi && state.selectedPackages.length >= 1) {
      onUpdate({ selectedPackages: [pkg], packageCodes: [pkg.packageCode] });
    } else {
      onUpdate({
        selectedPackages: [
          ...state.selectedPackages.filter(
            (p) => p.packageCode !== pkg.packageCode,
          ),
          pkg,
        ],
        packageCodes: [
          ...state.packageCodes.filter((c) => c !== pkg.packageCode),
          pkg.packageCode,
        ],
      });
    }
  };

  const removePackage = (code: string) => {
    onUpdate({
      selectedPackages: state.selectedPackages.filter(
        (p) => p.packageCode !== code,
      ),
      packageCodes: state.packageCodes.filter((c) => c !== code),
    });
  };

  const addIcd = (icd: IcdMaster) => {
    if (state.diagnosisCodes.includes(icd.code)) return;
    const newCodes = [...state.diagnosisCodes, icd.code];
    const newName = state.diagnosisName
      ? `${state.diagnosisName}; ${icd.description}`
      : icd.description;
    onUpdate({ diagnosisCodes: newCodes, diagnosisName: newName });
    setIcdQuery("");
    setShowIcdDropdown(false);
  };

  const removeIcd = (code: string) => {
    onUpdate({
      diagnosisCodes: state.diagnosisCodes.filter((c) => c !== code),
    });
  };

  const totalRate = state.selectedPackages.reduce((s, p) => s + p.rate, 0);

  const handleCreatePreAuth = async () => {
    if (!actor || !state.patientData || state.selectedPackages.length === 0)
      return;
    if (state.diagnosisCodes.length === 0) {
      toast.error("Add at least one ICD-10 diagnosis code");
      return;
    }
    setPreAuthError(null);
    setSubmitting(true);
    try {
      // Strip checklist to ONLY the 3 fields defined in DocChecklistItem
      // (docName, required, submitted) — extra fields like docType/packageCode
      // cause silent Candid serialization failures on the backend
      const checklist: DocChecklistItem[] = buildDocChecklist(
        state.selectedPackages,
        state.mode ?? "surgical",
      ).map((d) => ({
        docName: String(d.docName || "").trim(),
        required: Boolean(d.required),
        submitted: false,
      }));

      // Safe TAT conversion: guard against NaN/0/undefined from numeric input
      const rawTAT = Number(state.tatHours);
      const safeTAT = BigInt(Math.max(1, Number.isNaN(rawTAT) ? 48 : rawTAT));

      const req = {
        patientId: String(state.patientData.id).trim(),
        patientName: String(state.patientData.name).trim(),
        packageCode: state.packageCodes.join("; "),
        packageName: state.selectedPackages
          .map((p) => p.packageName)
          .join("; "),
        diagnosisName: String(
          state.diagnosisName || state.diagnosisCodes.join("; "),
        ).trim(),
        schemeType: String(
          state.schemeType || state.patientData.payerType || "Other",
        ).trim(),
        payerName: String(state.patientData.payerName || "N/A").trim(),
        requestedAmount: String(totalRate > 0 ? totalRate : "0"),
        expectedTATHours: safeTAT,
        documentChecklist: checklist,
      };

      console.log(
        "[PreAuth/RCMWorkflow] Submitting PreAuthRequest:",
        JSON.stringify(req, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      );

      const res = await actor.createPreAuth(req);
      if ("ok" in res) {
        const newDocChecklist = buildDocChecklist(
          state.selectedPackages,
          state.mode ?? "surgical",
        );
        onUpdate({ preAuthId: res.ok, docChecklist: newDocChecklist });
        toast.success(`Pre-Auth created successfully: ${res.ok}`);
        onComplete();
      } else if ("err" in res) {
        console.error("[PreAuth/RCMWorkflow] Backend returned error:", res.err);
        setPreAuthError(`Backend error: ${res.err}`);
        toast.error(`Pre-Auth failed: ${res.err}`);
      } else {
        console.error("[PreAuth/RCMWorkflow] Unexpected response shape:", res);
        setPreAuthError("Unexpected response from backend. Check console.");
        toast.error("Pre-Auth failed: unexpected response from backend");
      }
    } catch (err) {
      console.error("[PreAuth/RCMWorkflow] createPreAuth threw:", err);
      const message = err instanceof Error ? err.message : String(err);
      setPreAuthError(`Exception: ${message}`);
      toast.error(`Failed to create Pre-Auth: ${message}`, {
        description: "Check the browser console for full details.",
        duration: 8000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-hp-body mb-1">
          Package & Pre-Authorization
        </h2>
        <p className="text-sm text-hp-muted">
          {multi
            ? "Add multiple packages — combined checklist is generated automatically."
            : "Select a package, confirm diagnosis, and submit Pre-Auth."}
        </p>
      </div>

      {/* Package Search */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
        <h3 className="text-sm font-bold text-hp-body mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-hp-blue" />
          {multi ? "Add Packages" : "Select Package"}
        </h3>
        <PackageSearchPanel
          packages={allPackages}
          mode={state.mode ?? "surgical"}
          selectedCodes={state.packageCodes}
          onAdd={addPackage}
          onRemove={removePackage}
          multi={multi}
        />
      </div>

      {/* Selected packages */}
      {state.selectedPackages.length > 0 && (
        <div className="space-y-2">
          {state.selectedPackages.map((pkg) => (
            <div
              key={pkg.packageCode}
              className="flex items-center gap-3 bg-white rounded-xl border border-emerald-200 p-3 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-hp-muted">
                    {pkg.packageCode}
                  </span>
                  <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full py-0">
                    Selected
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-hp-body line-clamp-1">
                  {pkg.packageName}
                </p>
                <p className="text-xs text-hp-muted">
                  {pkg.speciality} · {formatRate(pkg.rate)}
                </p>
              </div>
              {multi && (
                <button
                  type="button"
                  onClick={() => removePackage(pkg.packageCode)}
                  className="text-hp-muted hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {multi && state.selectedPackages.length > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm font-bold text-hp-body">
              <span className="text-hp-muted">Combined Rate Estimate:</span>
              <span className="text-hp-blue text-base">
                {formatRate(totalRate)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ICD-10 Diagnosis */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
        <h3 className="text-sm font-bold text-hp-body mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-hp-blue" /> Diagnosis (ICD-10)
        </h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted" />
          <input
            type="text"
            placeholder="Type ICD-10 code or diagnosis name…"
            value={icdQuery}
            onChange={(e) => {
              setIcdQuery(e.target.value);
              setShowIcdDropdown(true);
            }}
            onFocus={() => setShowIcdDropdown(true)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-hp-border rounded-lg bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 transition"
          />
          {showIcdDropdown && filteredIcds.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-hp-border shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {filteredIcds.map((icd) => (
                <button
                  key={icd.code}
                  type="button"
                  onClick={() => addIcd(icd)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-hp-bg transition-colors text-left border-b border-hp-border last:border-0"
                >
                  <span className="text-xs font-bold text-hp-blue min-w-[60px]">
                    {icd.code}
                  </span>
                  <span className="text-sm text-hp-body line-clamp-1">
                    {icd.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {state.diagnosisCodes.map((code) => {
            const icd = icds.find((i) => i.code === code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-full px-3 py-1"
              >
                {code}
                {icd && ` — ${icd.description.slice(0, 30)}`}
                <button
                  type="button"
                  onClick={() => removeIcd(code)}
                  className="hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {state.diagnosisCodes.length === 0 && (
            <p className="text-xs text-hp-muted italic">
              No diagnosis codes added yet
            </p>
          )}
        </div>
      </div>

      {/* Config: Scheme, Doctor, TAT, Ward */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
        <h3 className="text-sm font-bold text-hp-body mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-hp-blue" /> Authorization Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="wf-scheme-type"
              className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
            >
              Scheme Type
            </label>
            <select
              id="wf-scheme-type"
              value={state.schemeType}
              onChange={(e) => onUpdate({ schemeType: e.target.value })}
              className="w-full text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
            >
              <option value="">Select Scheme</option>
              {["Govt Scheme", "PSU", "Self Pay", "TPA"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="wf-attending-doctor"
              className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
            >
              Attending Doctor
            </label>
            <select
              id="wf-attending-doctor"
              value={state.attendingDoctorId}
              onChange={(e) => {
                const doc = doctors.find((d) => d.id === e.target.value);
                onUpdate({
                  attendingDoctorId: e.target.value,
                  attendingDoctorName: doc?.name ?? "",
                });
              }}
              className="w-full text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
            >
              <option value="">Select Doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.department}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="wf-tat-hours"
              className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
            >
              TAT (Hours)
            </label>
            <input
              id="wf-tat-hours"
              type="number"
              min={1}
              value={state.tatHours}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                onUpdate({ tatHours: Number.isNaN(v) ? 48 : Math.max(1, v) });
              }}
              className="w-full text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
            />
          </div>
          {state.mode === "medical" && (
            <>
              <div>
                <label
                  htmlFor="wf-ward"
                  className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
                >
                  Ward / Room
                </label>
                <select
                  id="wf-ward"
                  value={state.wardId}
                  onChange={(e) => onUpdate({ wardId: e.target.value })}
                  className="w-full text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
                >
                  <option value="">Select Ward</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.wardType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="wf-los"
                  className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
                >
                  Expected LOS (Days)
                </label>
                <input
                  id="wf-los"
                  type="number"
                  min={1}
                  value={state.expectedLOS}
                  onChange={(e) =>
                    onUpdate({ expectedLOS: Number(e.target.value) })
                  }
                  className="w-full text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pre-Auth error banner */}
      {preAuthError && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4"
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              Pre-Auth Creation Failed
            </p>
            <p className="text-xs text-red-700 mt-0.5 break-words">
              {preAuthError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreAuthError(null)}
            className="shrink-0 text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pre-Auth success badge */}
      {state.preAuthId && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">
              Pre-Auth Created Successfully
            </p>
            <p className="text-xs text-emerald-600">ID: {state.preAuthId}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          data-ocid="workflow.create_preauth"
          disabled={
            submitting ||
            isFetching ||
            state.selectedPackages.length === 0 ||
            state.diagnosisCodes.length === 0 ||
            !!state.preAuthId
          }
          onClick={handleCreatePreAuth}
          className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl px-6"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Pre-Auth…
            </>
          ) : state.preAuthId ? (
            "Pre-Auth Done ✓"
          ) : (
            "Create Pre-Auth & Continue"
          )}
          {!submitting && !state.preAuthId && (
            <ChevronRight className="h-4 w-4 ml-1" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Clinical Docs ────────────────────────────────────────────────────

function Step3ClinicalDocs({
  state,
  onUpdate,
  onComplete,
}: {
  state: WorkflowState;
  onUpdate: (patch: Partial<WorkflowState>) => void;
  onComplete: () => void;
}) {
  const { actor, isFetching } = useActor();
  const [submitting, setSubmitting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const checklist = state.docChecklist;
  const uploadedFiles = state.uploadedFiles;

  const mandatoryCount = checklist.filter((d) => d.required).length;
  const uploadedMandatoryCount = checklist.filter(
    (d) => d.required && uploadedFiles[d.docName],
  ).length;
  const totalUploaded = Object.keys(uploadedFiles).length;

  const toggleCheck = (docName: string) => {
    const updated = checklist.map((d) =>
      d.docName === docName ? { ...d, submitted: !d.submitted } : d,
    );
    onUpdate({ docChecklist: updated });
  };

  const handleFileUpload = (docName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) ?? "";
      const newFiles = {
        ...uploadedFiles,
        [docName]: {
          name: file.name,
          size: file.size,
          docLabel: docName,
          dataUrl,
        },
      };
      const updatedChecklist = checklist.map((d) =>
        d.docName === docName ? { ...d, submitted: true } : d,
      );
      onUpdate({ uploadedFiles: newFiles, docChecklist: updatedChecklist });
      toast.success(`Uploaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (docName: string) => {
    const { [docName]: _removed, ...rest } = uploadedFiles;
    const updatedChecklist = checklist.map((d) =>
      d.docName === docName ? { ...d, submitted: false } : d,
    );
    onUpdate({ uploadedFiles: rest, docChecklist: updatedChecklist });
  };

  const handleSave = async () => {
    if (!actor || !state.patientData) return;
    setSubmitting(true);
    try {
      const req = {
        patientId: state.patientData.id,
        patientName: state.patientData.name,
        packageCodes: state.packageCodes,
        packageNames: state.selectedPackages.map((p) => p.packageName),
        documentChecklist: checklist,
        doctorNotes: state.doctorNotes,
        dischargeSummary: state.dischargeSummary,
      };
      const res = await actor.createClinicalDoc(req);
      if ("ok" in res) {
        onUpdate({ clinicalDocId: res.ok });
        toast.success(`Clinical Docs saved: ${res.ok}`);
        onComplete();
      } else if ("err" in res) {
        toast.error(`Save failed: ${res.err}`);
      }
    } catch {
      toast.error("Failed to save clinical docs");
    } finally {
      setSubmitting(false);
    }
  };

  // Group by standard vs package-specific
  const standardItems = checklist.filter((d) => d.packageCode === "ALL");
  const packageItems = checklist.filter((d) => d.packageCode !== "ALL");

  const renderChecklistItem = (doc: ClinicalDocChecklistItem) => {
    const uploaded = uploadedFiles[doc.docName];
    const isSubmitted = doc.submitted || !!uploaded;
    return (
      <div
        key={doc.docName}
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3 transition-all",
          isSubmitted
            ? "border-emerald-200 bg-emerald-50"
            : doc.required
              ? "border-red-200 bg-red-50/40"
              : "border-amber-200 bg-amber-50/30",
        )}
      >
        <button
          type="button"
          onClick={() => toggleCheck(doc.docName)}
          className={cn(
            "mt-0.5 h-5 w-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors",
            isSubmitted
              ? "bg-emerald-500 border-emerald-500"
              : doc.required
                ? "border-red-400 bg-white"
                : "border-amber-400 bg-white",
          )}
        >
          {isSubmitted && <CheckCircle2 className="h-3 w-3 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                "text-sm font-semibold",
                isSubmitted ? "text-emerald-800 line-through" : "text-hp-body",
              )}
            >
              {doc.docName}
            </span>
            <Badge
              className={cn(
                "text-[10px] rounded-full py-0 border",
                doc.required
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200",
              )}
            >
              {doc.required ? "Required" : "Optional"}
            </Badge>
          </div>
          {uploaded && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-emerald-700 font-medium truncate max-w-[200px]">
                {uploaded.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(doc.docName)}
                className="text-hp-muted hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {isSubmitted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : doc.required ? (
            <AlertCircle className="h-4 w-4 text-red-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          )}
          <button
            type="button"
            onClick={() => fileInputRefs.current[doc.docName]?.click()}
            className="text-[10px] font-semibold text-hp-blue bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors flex items-center gap-1"
          >
            <Upload className="h-3 w-3" /> Upload
          </button>
          <input
            ref={(el) => {
              fileInputRefs.current[doc.docName] = el;
            }}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => {
              if (e.target.files?.[0])
                handleFileUpload(doc.docName, e.target.files[0]);
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-hp-body mb-1">
          Clinical Documentation
        </h2>
        <p className="text-sm text-hp-muted">
          Upload and verify all required documents. Green = ready, Red = missing
          mandatory.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-hp-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-hp-body">
            Document Progress
          </span>
          <span className="text-sm font-bold text-hp-blue">
            {uploadedMandatoryCount} / {mandatoryCount} mandatory
          </span>
        </div>
        <div className="h-3 bg-hp-border rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              uploadedMandatoryCount === mandatoryCount
                ? "bg-emerald-500"
                : "bg-hp-blue",
            )}
            style={{
              width: `${mandatoryCount > 0 ? (uploadedMandatoryCount / mandatoryCount) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {totalUploaded} uploaded
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />{" "}
            {mandatoryCount - uploadedMandatoryCount} mandatory missing
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />{" "}
            {
              checklist.filter((d) => !d.required && !uploadedFiles[d.docName])
                .length
            }{" "}
            optional pending
          </span>
        </div>
      </div>

      {/* Missing doc warning */}
      {mandatoryCount - uploadedMandatoryCount > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              Missing Mandatory Documents
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {checklist
                .filter((d) => d.required && !uploadedFiles[d.docName])
                .map((d) => d.docName)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Standard checklist */}
      {standardItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
          <h3 className="text-sm font-bold text-hp-body mb-3 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-hp-blue" />
            Standard{" "}
            {state.mode === "medical" ? "Medical Management" : "Surgical"}{" "}
            Documents
            <Badge className="ml-auto bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
              {standardItems.length} items
            </Badge>
          </h3>
          <div className="space-y-2">
            {standardItems.map(renderChecklistItem)}
          </div>
        </div>
      )}

      {/* Package-specific */}
      {packageItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
          <h3 className="text-sm font-bold text-hp-body mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-hp-blue" /> Package-Specific
            Documents
            <Badge className="ml-auto bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
              {packageItems.length} items
            </Badge>
          </h3>
          <div className="space-y-2">
            {packageItems.map(renderChecklistItem)}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm">
        <h3 className="text-sm font-bold text-hp-body mb-4">Clinical Notes</h3>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="wf-doctor-notes"
              className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
            >
              Doctor Notes
            </label>
            <textarea
              id="wf-doctor-notes"
              value={state.doctorNotes}
              onChange={(e) => onUpdate({ doctorNotes: e.target.value })}
              rows={3}
              placeholder="Clinical observations, treatment plan, procedure details…"
              className="w-full text-sm border border-hp-border rounded-xl px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="wf-discharge-summary"
              className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
            >
              Discharge Summary
            </label>
            <textarea
              id="wf-discharge-summary"
              value={state.dischargeSummary}
              onChange={(e) => onUpdate({ dischargeSummary: e.target.value })}
              rows={3}
              placeholder="Discharge diagnosis, instructions, follow-up plan…"
              className="w-full text-sm border border-hp-border rounded-xl px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 resize-none"
            />
          </div>
        </div>
      </div>

      {state.clinicalDocId && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">
              Clinical Docs Saved
            </p>
            <p className="text-xs text-emerald-600">
              ID: {state.clinicalDocId}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button
          data-ocid="workflow.save_clinical_docs"
          disabled={submitting || isFetching || !!state.clinicalDocId}
          onClick={handleSave}
          className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl px-6"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : state.clinicalDocId ? (
            "Docs Saved ✓"
          ) : (
            "Save Docs & Continue"
          )}
          {!submitting && !state.clinicalDocId && (
            <ChevronRight className="h-4 w-4 ml-1" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Claim Submission ─────────────────────────────────────────────────

function Step4ClaimSubmission({
  state,
  onUpdate,
  onNavigate,
  onComplete,
  onReset,
}: {
  state: WorkflowState;
  onUpdate: (patch: Partial<WorkflowState>) => void;
  onNavigate: (tab: string) => void;
  onComplete: () => void;
  onReset: () => void;
}) {
  const { actor, isFetching } = useActor();
  const [submitting, setSubmitting] = useState(false);
  const [ackMissing, setAckMissing] = useState(false);

  const missingMandatory = state.docChecklist.filter(
    (d) => d.required && !d.submitted && !state.uploadedFiles[d.docName],
  );
  const hasMissingMandatory = missingMandatory.length > 0;

  const totalRate = state.selectedPackages.reduce((s, p) => s + p.rate, 0);

  useEffect(() => {
    if (!state.claimAmount && totalRate > 0) {
      onUpdate({ claimAmount: String(totalRate) });
    }
  }, [totalRate, state.claimAmount, onUpdate]);

  const handleSubmit = async () => {
    if (!actor || !state.patientData) return;
    if (hasMissingMandatory && !ackMissing) {
      toast.error("Acknowledge missing documents before submitting");
      return;
    }
    setSubmitting(true);
    try {
      const docChecklist: DocChecklistItem[] = state.docChecklist.map((d) => ({
        docName: d.docName,
        required: d.required,
        submitted: d.submitted || !!state.uploadedFiles[d.docName],
      }));
      const req = {
        patientId: state.patientData.id,
        patientName: state.patientData.name,
        packageCode: state.packageCodes.join("; "),
        packageName: state.selectedPackages
          .map((p) => p.packageName)
          .join("; "),
        diagnosisName: state.diagnosisName,
        icdCode: state.diagnosisCodes.join("; "),
        schemeType: state.schemeType || state.patientData.payerType,
        payerName: state.patientData.payerName,
        preAuthId: state.preAuthId,
        billedAmount: state.claimAmount,
        approvedAmount: "",
        admissionDate: "",
        dischargeDate: "",
        claimType:
          state.mode === "surgical"
            ? "Surgical"
            : state.mode === "medical"
              ? "Medical Management"
              : "Multi-Package",
        procedureDetails: state.claimRemarks,
        documentChecklist: docChecklist,
      };
      const res = await actor.createClaim(req);
      if ("ok" in res) {
        onUpdate({ claimId: res.ok });
        toast.success(`Claim submitted: ${res.ok}`);
        onComplete();
      } else if ("err" in res) {
        toast.error(`Claim failed: ${res.err}`);
      }
    } catch {
      toast.error("Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (state.claimId) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-50 border-4 border-emerald-200 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-hp-body mb-2">
            Claim Submitted!
          </h2>
          <p className="text-hp-muted text-sm">
            Your claim has been successfully submitted and is now under review.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-hp-border p-5 text-left space-y-3 shadow-sm">
          {[
            { label: "Claim ID", value: state.claimId },
            { label: "Pre-Auth ID", value: state.preAuthId },
            { label: "Patient", value: state.patientData?.name ?? "—" },
            { label: "Package(s)", value: state.packageCodes.join(", ") },
            {
              label: "Billed Amount",
              value: formatRate(Number(state.claimAmount)),
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-hp-border pb-3 last:border-0 last:pb-0"
            >
              <span className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
                {row.label}
              </span>
              <span className="text-sm font-semibold text-hp-body">
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={() => onNavigate("aging-ar")}
            variant="outline"
            className="rounded-xl border-hp-border text-hp-body font-semibold"
          >
            <Receipt className="h-4 w-4 mr-2" /> Aging AR Tracker
          </Button>
          <Button
            onClick={() => onNavigate("rcm")}
            variant="outline"
            className="rounded-xl border-hp-border text-hp-body font-semibold"
          >
            <Users className="h-4 w-4 mr-2" /> Patient Timeline
          </Button>
          <Button
            onClick={onReset}
            className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Start New Case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-hp-body mb-1">
          Claim Submission
        </h2>
        <p className="text-sm text-hp-muted">
          Review all pre-filled details. Edit amount or remarks if needed.
        </p>
      </div>

      {/* Missing doc validation banner */}
      {hasMissingMandatory && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">
                {missingMandatory.length} Mandatory Documents Missing
              </p>
              <ul className="mt-1.5 space-y-1">
                {missingMandatory.slice(0, 5).map((d) => (
                  <li
                    key={d.docName}
                    className="text-xs text-red-700 flex items-center gap-1.5"
                  >
                    <Circle className="h-2 w-2 fill-current" /> {d.docName}
                  </li>
                ))}
                {missingMandatory.length > 5 && (
                  <li className="text-xs text-red-600 font-semibold">
                    + {missingMandatory.length - 5} more…
                  </li>
                )}
              </ul>
            </div>
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ackMissing}
              onChange={(e) => setAckMissing(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-red-400 text-red-600"
            />
            <span className="text-xs font-semibold text-red-800">
              I acknowledge the missing documents and want to proceed with claim
              submission.
            </span>
          </label>
        </div>
      )}

      {/* Pre-filled claim data */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-hp-body flex items-center gap-2">
          <Receipt className="h-4 w-4 text-hp-blue" /> Claim Details
          (Auto-filled)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Patient Name", value: state.patientData?.name ?? "—" },
            { label: "ABHA ID", value: state.patientData?.abhaId ?? "—" },
            {
              label: "Package Code(s)",
              value: state.packageCodes.join(", ") || "—",
            },
            { label: "Pre-Auth ID", value: state.preAuthId || "—" },
            { label: "Clinical Doc ID", value: state.clinicalDocId || "—" },
            { label: "Diagnosis", value: state.diagnosisName || "—" },
            { label: "Scheme Type", value: state.schemeType || "—" },
            {
              label: "TPA / Payer",
              value: state.patientData?.payerName ?? "—",
            },
          ].map((row) => (
            <div key={row.label} className="bg-hp-bg rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-hp-muted mb-0.5">
                {row.label}
              </p>
              <p className="text-xs font-semibold text-hp-body truncate">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-2xl border border-hp-border p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-hp-body mb-2">Editable Fields</h3>
        <div>
          <label
            htmlFor="wf-claim-amount"
            className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
          >
            Claim Amount (₹)
          </label>
          <input
            id="wf-claim-amount"
            type="number"
            value={state.claimAmount}
            onChange={(e) => onUpdate({ claimAmount: e.target.value })}
            className="w-full text-sm border border-hp-border rounded-xl px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
          />
        </div>
        <div>
          <label
            htmlFor="wf-claim-remarks"
            className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-1.5 block"
          >
            Remarks / Additional Notes
          </label>
          <textarea
            id="wf-claim-remarks"
            value={state.claimRemarks}
            onChange={(e) => onUpdate({ claimRemarks: e.target.value })}
            rows={3}
            placeholder="Procedure details, special conditions, remarks for the insurer…"
            className="w-full text-sm border border-hp-border rounded-xl px-3 py-2 bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button
          data-ocid="workflow.submit_claim"
          disabled={
            submitting || isFetching || (hasMissingMandatory && !ackMissing)
          }
          onClick={handleSubmit}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-8 text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              Submit Claim <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Case Dashboard ───────────────────────────────────────────────────────────

function CaseDashboard({
  onStartNew,
  onResume,
  savedState,
}: {
  onStartNew: (mode: WorkflowMode) => void;
  onResume: () => void;
  savedState: WorkflowState | null;
}) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Resume banner */}
      {savedState?.mode &&
        !savedState.claimId &&
        savedState.completedSteps.length > 0 && (
          <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="h-12 w-12 bg-hp-blue rounded-xl flex items-center justify-center shrink-0">
              <RotateCcw className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-hp-body">
                Workflow In Progress
              </p>
              <p className="text-xs text-hp-muted mt-0.5">
                Patient: {savedState.patientData?.name ?? "—"} · Mode:{" "}
                {savedState.mode} · {savedState.completedSteps.length} of 4
                steps complete
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onResume}
                className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl text-sm"
              >
                Resume Workflow <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-hp-blue/10 rounded-full px-4 py-1.5 text-sm font-semibold text-hp-blue mb-3 border border-hp-blue/20">
          <Activity className="h-4 w-4" /> RCM Workflow Suite
        </div>
        <h1 className="text-3xl font-bold text-hp-body mb-2">
          Start a New Case
        </h1>
        <p className="text-hp-muted text-base max-w-xl mx-auto">
          Select your workflow mode to begin the guided 4-step process: Patient
          → Package & Pre-Auth → Clinical Docs → Claim Submission.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid sm:grid-cols-3 gap-5">
        {MODE_CONFIGS.map((cfg) => (
          <div
            key={cfg.mode}
            className={cn(
              "rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-all group",
              cfg.borderColor,
              cfg.bgColor,
            )}
          >
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center mb-4 border",
                cfg.bgColor,
                cfg.borderColor,
              )}
            >
              <cfg.icon className={cn("h-6 w-6", cfg.color)} />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className={cn("text-base font-bold", cfg.color)}>
                {cfg.label}
              </h3>
              <Badge
                className={cn(
                  "text-[10px] rounded-full border",
                  cfg.badgeColor,
                )}
              >
                {cfg.badgeText}
              </Badge>
            </div>
            <p className="text-sm text-hp-muted mb-4 leading-relaxed">
              {cfg.description}
            </p>
            <ul className="space-y-1.5 mb-5">
              {cfg.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-xs text-hp-muted"
                >
                  <CheckCircle2
                    className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", cfg.color)}
                  />
                  {b}
                </li>
              ))}
            </ul>
            <Button
              data-ocid={`workflow.start.${cfg.mode}`}
              onClick={() => onStartNew(cfg.mode)}
              className={cn(
                "w-full font-bold rounded-xl text-sm",
                cfg.mode === "surgical"
                  ? "bg-hp-blue hover:bg-hp-navy text-white"
                  : cfg.mode === "medical"
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : "bg-violet-600 hover:bg-violet-700 text-white",
              )}
            >
              Start Workflow <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ))}
      </div>

      {/* Workflow preview */}
      <div className="bg-white rounded-2xl border border-hp-border p-6 shadow-sm">
        <h3 className="text-sm font-bold text-hp-body mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-hp-blue" /> 4-Step Guided Workflow
        </h3>
        <div className="flex flex-wrap items-center gap-0">
          {[
            {
              icon: User,
              label: "Patient Lookup",
              desc: "Search & auto-fill patient details",
            },
            {
              icon: Package,
              label: "Package & Pre-Auth",
              desc: "Select package, ICD-10, submit pre-auth",
            },
            {
              icon: FileText,
              label: "Clinical Docs",
              desc: "Upload & verify all documents",
            },
            {
              icon: Receipt,
              label: "Claim Submission",
              desc: "Auto-filled claim ready to submit",
            },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className="flex items-center gap-3 bg-hp-bg rounded-xl px-4 py-3 border border-hp-border min-w-[160px]">
                <div className="h-8 w-8 rounded-lg bg-hp-blue/10 flex items-center justify-center shrink-0">
                  <step.icon className="h-4 w-4 text-hp-blue" />
                </div>
                <div>
                  <p className="text-xs font-bold text-hp-body">{step.label}</p>
                  <p className="text-[10px] text-hp-muted">{step.desc}</p>
                </div>
              </div>
              {i < 3 && (
                <ChevronRight className="h-4 w-4 text-hp-muted mx-1 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export function RCMWorkflowModule({
  onNavigate,
}: { onNavigate: (tab: string, data?: Record<string, unknown>) => void }) {
  const [wfState, setWfState] = useState<WorkflowState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as WorkflowState) : defaultState;
    } catch {
      return defaultState;
    }
  });
  const [allPackages, setAllPackages] = useState<HealthPackage[]>([]);
  const [showDashboard, setShowDashboard] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return true;
      const parsed = JSON.parse(saved) as WorkflowState;
      return !parsed.mode;
    } catch {
      return true;
    }
  });

  const updateState = useCallback((patch: Partial<WorkflowState>) => {
    setWfState((prev) => {
      const next = { ...prev, ...patch, savedAt: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  // Load packages.json
  useEffect(() => {
    fetch("/assets/packages.json")
      .then((r) => r.json())
      .then((d: HealthPackage[]) => setAllPackages(d))
      .catch(() => {});
  }, []);

  const steps: WorkflowStep[] = useMemo(
    () => [
      {
        id: 0,
        title: "Patient Lookup",
        subtitle: wfState.patientData?.name ?? "Search registered patient",
        icon: User,
        status: getStepStatus(0, wfState.currentStep, wfState.completedSteps),
      },
      {
        id: 1,
        title: "Package & Pre-Auth",
        subtitle: wfState.preAuthId
          ? `ID: ${wfState.preAuthId.slice(0, 12)}…`
          : "Select package & create pre-auth",
        icon: Package,
        status: getStepStatus(1, wfState.currentStep, wfState.completedSteps),
      },
      {
        id: 2,
        title: "Clinical Docs",
        subtitle: wfState.clinicalDocId
          ? `ID: ${wfState.clinicalDocId.slice(0, 12)}…`
          : "Upload & verify documents",
        icon: FileText,
        status: getStepStatus(2, wfState.currentStep, wfState.completedSteps),
      },
      {
        id: 3,
        title: "Claim Submission",
        subtitle: wfState.claimId
          ? `Claim: ${wfState.claimId.slice(0, 12)}…`
          : "Submit claim",
        icon: Receipt,
        status: getStepStatus(3, wfState.currentStep, wfState.completedSteps),
      },
    ],
    [wfState],
  );

  const handleStartNew = (mode: WorkflowMode) => {
    const fresh: WorkflowState = {
      ...defaultState,
      mode,
      currentStep: 0,
      savedAt: Date.now(),
    };
    setWfState(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* quota */
    }
    setShowDashboard(false);
  };

  const handleReset = () => {
    const fresh = { ...defaultState, savedAt: Date.now() };
    setWfState(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* quota */
    }
    setShowDashboard(true);
  };

  const handleStepComplete = (stepId: number) => {
    const nextStep = stepId + 1;
    updateState({
      completedSteps: [
        ...wfState.completedSteps.filter((s) => s !== stepId),
        stepId,
      ],
      currentStep: nextStep,
    });
  };

  const handleStepJump = (stepId: number) => {
    updateState({ currentStep: stepId });
  };

  const savedStateForDashboard = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as WorkflowState) : null;
    } catch {
      return null;
    }
  })();

  if (showDashboard) {
    return (
      <div className="flex-1 bg-hp-bg">
        <CaseDashboard
          onStartNew={handleStartNew}
          onResume={() => setShowDashboard(false)}
          savedState={savedStateForDashboard}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-hp-bg">
      {/* Stepper */}
      <WorkflowStepper
        steps={steps}
        currentStep={wfState.currentStep}
        completedSteps={wfState.completedSteps}
        onStepClick={handleStepJump}
        patientName={wfState.patientData?.name}
        mode={wfState.mode}
      />

      {/* Top action bar */}
      <div className="bg-white border-b border-hp-border px-4 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowDashboard(true)}
          className="text-xs font-semibold text-hp-muted hover:text-hp-body flex items-center gap-1.5 transition-colors"
        >
          ← Back to Dashboard
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors"
          data-ocid="workflow.reset"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset Workflow
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {wfState.currentStep === 0 && (
          <Step1PatientLookup
            state={wfState}
            onUpdate={updateState}
            onNavigate={onNavigate}
            onComplete={() => handleStepComplete(0)}
          />
        )}
        {wfState.currentStep === 1 && (
          <Step2PackagePreAuth
            state={wfState}
            allPackages={allPackages}
            onUpdate={updateState}
            onComplete={() => handleStepComplete(1)}
          />
        )}
        {wfState.currentStep === 2 && (
          <Step3ClinicalDocs
            state={wfState}
            onUpdate={updateState}
            onComplete={() => handleStepComplete(2)}
          />
        )}
        {wfState.currentStep === 3 && (
          <Step4ClaimSubmission
            state={wfState}
            onUpdate={updateState}
            onNavigate={onNavigate}
            onComplete={() => handleStepComplete(3)}
            onReset={handleReset}
          />
        )}
        {/* Free-jump to already completed step */}
        {wfState.currentStep > 3 && (
          <div className="max-w-xl mx-auto py-12 px-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-hp-body mb-2">
              All Steps Complete!
            </h2>
            <p className="text-hp-muted mb-6">
              The workflow is fully complete. Start a new case or review records
              in the individual modules.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={() => onNavigate("aging-ar")}
                variant="outline"
                className="rounded-xl font-semibold"
              >
                <Receipt className="h-4 w-4 mr-2" /> Aging AR Tracker
              </Button>
              <Button
                onClick={handleReset}
                className="bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> New Case
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
