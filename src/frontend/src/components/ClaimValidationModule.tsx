import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  FileIcon,
  FileImage,
  FileText,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaseType = "surgical" | "medical";
type ValidationStatus = "Pass" | "Warnings" | "Failed" | "NotValidated";
type RequiredLevel = "Mandatory" | "Conditional" | "Optional";

interface ChecklistItem {
  id: string;
  name: string;
  required: RequiredLevel;
  keywords: string[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  matchedItemId: string | null;
}

interface ClaimValidationRecord {
  claimId: string;
  caseType: CaseType;
  validationStatus: ValidationStatus;
  missingMandatory: string[];
  missingConditional: string[];
  validatedAt: string;
  submittedWithWarning: boolean;
}

interface ClaimSearchResult {
  id: string;
  patientName: string;
  admissionDate: string;
  packageCode?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

const SURGICAL_CHECKLIST: ChecklistItem[] = [
  {
    id: "s1",
    name: "Pre USG/CT Reports with Film",
    required: "Mandatory",
    keywords: [
      "usg",
      "ct",
      "pre-op",
      "pre_op",
      "preop",
      "ultrasonography",
      "computed tomography",
      "film",
      "pre-usg",
      "xray",
      "x-ray",
    ],
  },
  {
    id: "s2",
    name: "Post Op HPE Report / HPE Request Form / Removed Sample Photo",
    required: "Mandatory",
    keywords: [
      "hpe",
      "post-op",
      "post_op",
      "postop",
      "histopathology",
      "sample",
      "removed",
      "biopsy",
      "hpe request",
    ],
  },
  {
    id: "s3",
    name: "Operative Notes",
    required: "Mandatory",
    keywords: [
      "operative",
      "operation notes",
      "ot notes",
      "surgical notes",
      "procedure notes",
      "op notes",
      "intraop",
    ],
  },
  {
    id: "s4",
    name: "Dr-Patient Photos",
    required: "Mandatory",
    keywords: [
      "dr pt",
      "doctor patient",
      "photo",
      "clinical photo",
      "case photo",
      "patient photo",
      "drpt",
    ],
  },
  {
    id: "s5",
    name: "Anesthesia Notes",
    required: "Mandatory",
    keywords: [
      "anesthesia",
      "anaesthesia",
      "anesthesia notes",
      "anaesthesia notes",
      "anesthesia record",
    ],
  },
  {
    id: "s6",
    name: "Pre-Anesthesia Checkup Notes",
    required: "Mandatory",
    keywords: [
      "pre anesthesia",
      "pre-anesthesia",
      "pre anaesthesia",
      "pac",
      "pre anesthetic",
      "pre-op anesthesia",
      "pre anesthesia checkup",
    ],
  },
  {
    id: "s7",
    name: "Intra OT Photos (Patient Face + Post-Op Scar)",
    required: "Mandatory",
    keywords: [
      "intra ot",
      "intra-ot",
      "ot photo",
      "scar",
      "post-op scar",
      "ot image",
      "intraoperative photo",
      "operation photo",
    ],
  },
  {
    id: "s8",
    name: "Discharge Summary",
    required: "Mandatory",
    keywords: [
      "discharge",
      "discharge summary",
      "discharge report",
      "final summary",
      "discharge note",
    ],
  },
];

const MEDICAL_CHECKLIST: ChecklistItem[] = [
  {
    id: "m1",
    name: "Dr Prescription (Complaints, Vitals, Seal & Sign)",
    required: "Mandatory",
    keywords: [
      "prescription",
      "rx",
      "medical prescription",
      "doctor prescription",
      "prescription sheet",
    ],
  },
  {
    id: "m2",
    name: "Day-wise ABG / Chest X-Ray / CBC / LFT / RFT Reports",
    required: "Mandatory",
    keywords: [
      "abg",
      "cbc",
      "lft",
      "rft",
      "day wise",
      "day-wise",
      "lab report",
      "chest x-ray",
      "xray",
      "x-ray",
      "blood report",
      "complete blood count",
      "liver function",
      "renal function",
    ],
  },
  {
    id: "m3",
    name: "Post Treatment Blood / X-Ray Reports with Film",
    required: "Mandatory",
    keywords: [
      "post treatment",
      "post-treatment",
      "post therapy",
      "final report",
      "follow-up report",
      "blood report",
      "x-ray film",
      "xray film",
    ],
  },
  {
    id: "m4",
    name: "Dr-Patient Photos",
    required: "Mandatory",
    keywords: [
      "dr pt",
      "doctor patient",
      "photo",
      "clinical photo",
      "case photo",
      "patient photo",
      "drpt",
    ],
  },
  {
    id: "m5",
    name: "ICU Chart (Vitals / GCS / O2 Saturation)",
    required: "Mandatory",
    keywords: [
      "icu chart",
      "icu",
      "vitals",
      "gcs",
      "glasgow",
      "o2 saturation",
      "spo2",
      "oxygen saturation",
      "icu record",
      "icu monitoring",
    ],
  },
  {
    id: "m6",
    name: "Day-wise ICPS with Seal & Sign",
    required: "Mandatory",
    keywords: [
      "icps",
      "intensive care",
      "progress sheet",
      "icu progress",
      "day-wise icps",
      "care plan sheet",
    ],
  },
  {
    id: "m7",
    name: "Day-wise ICU Photos with Patient Face",
    required: "Mandatory",
    keywords: [
      "icu photo",
      "icu image",
      "icu pic",
      "patient face",
      "day-wise icu",
      "icu daily photo",
    ],
  },
  {
    id: "m8",
    name: "Discharge Summary",
    required: "Mandatory",
    keywords: [
      "discharge",
      "discharge summary",
      "discharge report",
      "final summary",
      "discharge note",
    ],
  },
  {
    id: "m9",
    name: "CT / MRI / HPE Report with Film",
    required: "Conditional",
    keywords: [
      "ct report",
      "mri",
      "hpe report",
      "ct scan",
      "mri scan",
      "ct film",
      "mri film",
      "hpe film",
      "scan report",
      "imaging report",
      "radiology",
    ],
  },
  {
    id: "m10",
    name: "HbsAg Report (for Hepatitis cases)",
    required: "Conditional",
    keywords: [
      "hbsag",
      "hepatitis",
      "hepatitis b",
      "hbs ag",
      "hbsag report",
      "hepatitis report",
      "surface antigen",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchKeywords(filename: string, keywords: string[]): boolean {
  const lower = filename.toLowerCase().replace(/[_\-\.]/g, " ");
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function matchFileToChecklist(
  filename: string,
  items: ChecklistItem[],
): string | null {
  for (const item of items) {
    if (matchKeywords(filename, item.keywords)) return item.id;
  }
  return null;
}

function getStorageKey(claimId: string | null): string {
  return `claimValidationFiles_${claimId ?? "unlinked"}`;
}

function loadStoredFiles(claimId: string | null): UploadedFile[] {
  try {
    const raw = localStorage.getItem(getStorageKey(claimId));
    return raw ? (JSON.parse(raw) as UploadedFile[]) : [];
  } catch {
    return [];
  }
}

function saveStoredFiles(claimId: string | null, files: UploadedFile[]): void {
  localStorage.setItem(getStorageKey(claimId), JSON.stringify(files));
}

function loadValidationRecord(claimId: string): ClaimValidationRecord | null {
  try {
    const raw = localStorage.getItem(`claimValidation_${claimId}`);
    return raw ? (JSON.parse(raw) as ClaimValidationRecord) : null;
  } catch {
    return null;
  }
}

function saveValidationRecord(record: ClaimValidationRecord): void {
  localStorage.setItem(
    `claimValidation_${record.claimId}`,
    JSON.stringify(record),
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function computeValidationStatus(
  checklist: ChecklistItem[],
  matchedItemIds: Set<string>,
): {
  status: ValidationStatus;
  missingMandatory: string[];
  missingConditional: string[];
} {
  const missingMandatory = checklist
    .filter((i) => i.required === "Mandatory" && !matchedItemIds.has(i.id))
    .map((i) => i.name);
  const missingConditional = checklist
    .filter((i) => i.required === "Conditional" && !matchedItemIds.has(i.id))
    .map((i) => i.name);

  let status: ValidationStatus;
  if (missingMandatory.length === 0 && missingConditional.length === 0) {
    status = "Pass";
  } else if (missingMandatory.length === 0) {
    status = "Warnings";
  } else {
    status = "Failed";
  }
  return { status, missingMandatory, missingConditional };
}

function loadClaimsFromStorage(): ClaimSearchResult[] {
  try {
    const raw = localStorage.getItem("rcm_claims");
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<{
      id: string;
      patientName: string;
      admissionDate?: string;
      packageCode?: string;
      status?: string;
    }>;
    return arr.map((c) => ({
      id: c.id,
      patientName: c.patientName,
      admissionDate: c.admissionDate ?? "",
      packageCode: c.packageCode,
      status: c.status,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// File Type Icon
// ---------------------------------------------------------------------------

function FileTypeIcon({ type, name }: { type: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (
    type.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
  ) {
    return <FileImage className="h-4 w-4 text-purple-500 shrink-0" />;
  }
  if (type === "application/pdf" || ext === "pdf") {
    return <FileIcon className="h-4 w-4 text-red-500 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Validation Status Badge
// ---------------------------------------------------------------------------

export function ValidationStatusBadge({
  status,
}: { status: ValidationStatus }) {
  const config: Record<
    ValidationStatus,
    { label: string; icon: React.ReactNode; cls: string }
  > = {
    Pass: {
      label: "Pass",
      icon: <ShieldCheck className="h-3 w-3" />,
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    Warnings: {
      label: "Warnings",
      icon: <ShieldAlert className="h-3 w-3" />,
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    Failed: {
      label: "Failed",
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
// Upload Zone Wrapper
// ---------------------------------------------------------------------------

function UploadZoneWrapper({
  checklist,
  onFilesAdded,
}: {
  checklist: ChecklistItem[];
  onFilesAdded: (files: UploadedFile[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (rawFiles: File[]) => {
      if (rawFiles.length === 0) return;
      setIsProcessing(true);
      const WARN_SIZE = 5 * 1024 * 1024;
      const totalSize = rawFiles.reduce((s, f) => s + f.size, 0);
      if (totalSize > WARN_SIZE) {
        toast.warning(
          "Total upload size exceeds 5 MB — browser storage may hit limits.",
        );
      }
      const promises = rawFiles.map(
        (file) =>
          new Promise<UploadedFile | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              resolve({
                id: generateId(),
                name: file.name,
                size: file.size,
                type: file.type,
                dataUrl,
                uploadedAt: new Date().toISOString(),
                matchedItemId: matchFileToChecklist(file.name, checklist),
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      );
      Promise.all(promises).then((results) => {
        const valid = results.filter((f): f is UploadedFile => f !== null);
        if (valid.length > 0) {
          onFilesAdded(valid);
          toast.success(
            `${valid.length} file${valid.length > 1 ? "s" : ""} uploaded`,
          );
        }
        setIsProcessing(false);
      });
    },
    [checklist, onFilesAdded],
  );

  return (
    <button
      type="button"
      data-ocid="validation.upload.dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 select-none",
        isDragging
          ? "border-hp-blue bg-blue-50 scale-[1.01]"
          : "border-hp-border bg-hp-bg hover:border-hp-blue/60 hover:bg-blue-50/30",
        isProcessing && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
        multiple
        className="hidden"
        data-ocid="validation.upload.file_input"
        onChange={(e) => {
          processFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "p-3 rounded-full transition-colors",
          isDragging ? "bg-blue-100" : "bg-white border border-hp-border",
        )}
      >
        <UploadCloud
          className={cn(
            "h-7 w-7",
            isDragging ? "text-hp-blue" : "text-hp-muted",
          )}
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-hp-body">
          {isProcessing ? "Processing..." : "Drag & drop claim documents here"}
        </p>
        <p className="text-xs text-hp-muted mt-0.5">
          or{" "}
          <span className="text-hp-blue underline underline-offset-2">
            click to browse
          </span>
        </p>
        <p className="text-xs text-hp-muted mt-1">
          PDF, JPG, PNG, DOCX · 5 MB total recommended
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Warning Modal
// ---------------------------------------------------------------------------

function WarningModal({
  open,
  missingMandatory,
  missingConditional,
  onProceed,
  onCancel,
}: {
  open: boolean;
  missingMandatory: string[];
  missingConditional: string[];
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent data-ocid="validation.warning_modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Missing Documents — Proceed Anyway?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {missingMandatory.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                {missingMandatory.length} Mandatory Document
                {missingMandatory.length > 1 ? "s" : ""} Missing
              </p>
              <ul className="space-y-1">
                {missingMandatory.map((name) => (
                  <li
                    key={name}
                    className="flex items-start gap-2 text-xs text-red-800"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingConditional.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                {missingConditional.length} Conditional Document
                {missingConditional.length > 1 ? "s" : ""} Missing
              </p>
              <ul className="space-y-1">
                {missingConditional.map((name) => (
                  <li
                    key={name}
                    className="flex items-start gap-2 text-xs text-amber-800"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-hp-muted">
            The claim will be submitted with a <strong>warning flag</strong>.
            You can still resubmit with complete documentation later.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            data-ocid="validation.warning_modal.cancel_button"
            variant="outline"
            onClick={onCancel}
            className="border-hp-border"
          >
            Cancel
          </Button>
          <Button
            data-ocid="validation.warning_modal.proceed_button"
            onClick={onProceed}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Proceed Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Module
// ---------------------------------------------------------------------------

export function ClaimValidationModule({
  initialClaimId,
  onNavigate,
}: {
  initialClaimId?: string;
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
}) {
  const [caseType, setCaseType] = useState<CaseType>("surgical");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    initialClaimId ?? null,
  );
  const [selectedClaim, setSelectedClaim] = useState<ClaimSearchResult | null>(
    null,
  );
  const [claimSearch, setClaimSearch] = useState("");
  const [claimSearchResults, setClaimSearchResults] = useState<
    ClaimSearchResult[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() =>
    loadStoredFiles(initialClaimId ?? null),
  );
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checklist =
    caseType === "surgical" ? SURGICAL_CHECKLIST : MEDICAL_CHECKLIST;

  // Re-match files when case type changes
  const rematchFiles = useCallback(
    (files: UploadedFile[], newChecklist: ChecklistItem[]): UploadedFile[] => {
      return files.map((f) => ({
        ...f,
        matchedItemId: matchFileToChecklist(f.name, newChecklist),
      }));
    },
    [],
  );

  // When case type changes, re-match existing files
  useEffect(() => {
    setUploadedFiles((prev) => rematchFiles(prev, checklist));
  }, [checklist, rematchFiles]);

  // Load claim from localStorage when initialClaimId provided
  useEffect(() => {
    if (initialClaimId) {
      const claims = loadClaimsFromStorage();
      const claim = claims.find((c) => c.id === initialClaimId);
      if (claim) {
        setSelectedClaim(claim);
        setClaimSearch(claim.patientName);
      }
      setUploadedFiles(loadStoredFiles(initialClaimId));
    }
  }, [initialClaimId]);

  // Claim search handler
  const handleClaimSearch = useCallback((value: string) => {
    setClaimSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setClaimSearchResults([]);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(() => {
      const claims = loadClaimsFromStorage();
      const q = value.toLowerCase();
      const results = claims.filter(
        (c) =>
          c.patientName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
      setClaimSearchResults(results.slice(0, 8));
      setIsSearching(false);
    }, 300);
  }, []);

  function selectClaim(claim: ClaimSearchResult) {
    setSelectedClaimId(claim.id);
    setSelectedClaim(claim);
    setClaimSearch(claim.patientName);
    setClaimSearchResults([]);
    const stored = loadStoredFiles(claim.id);
    setUploadedFiles(rematchFiles(stored, checklist));
  }

  function handleFilesAdded(newFiles: UploadedFile[]) {
    setUploadedFiles((prev) => {
      const updated = [...prev, ...newFiles];
      saveStoredFiles(selectedClaimId, updated);
      return updated;
    });
  }

  function handleDeleteFile(fileId: string) {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      saveStoredFiles(selectedClaimId, updated);
      return updated;
    });
  }

  // Compute matched item IDs
  const matchedItemIds = new Set(
    uploadedFiles
      .map((f) => f.matchedItemId)
      .filter((id): id is string => id !== null),
  );

  const { status, missingMandatory, missingConditional } =
    computeValidationStatus(checklist, matchedItemIds);

  const mandatoryItems = checklist.filter((i) => i.required === "Mandatory");
  const mandatoryMatched = mandatoryItems.filter((i) =>
    matchedItemIds.has(i.id),
  ).length;
  const totalRequired = mandatoryItems.length;

  function handleSubmitClaim() {
    if (missingMandatory.length > 0 || missingConditional.length > 0) {
      setWarningModalOpen(true);
    } else {
      proceedSubmit(false);
    }
  }

  function proceedSubmit(withWarning: boolean) {
    setWarningModalOpen(false);
    setIsSubmitting(true);
    const finalStatus: ValidationStatus =
      missingMandatory.length > 0
        ? "Failed"
        : missingConditional.length > 0
          ? "Warnings"
          : "Pass";

    if (selectedClaimId) {
      const record: ClaimValidationRecord = {
        claimId: selectedClaimId,
        caseType,
        validationStatus: finalStatus,
        missingMandatory,
        missingConditional,
        validatedAt: new Date().toISOString(),
        submittedWithWarning: withWarning,
      };
      saveValidationRecord(record);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      if (withWarning) {
        toast.warning(
          "Claim submitted with warning flag. Missing documents noted.",
        );
      } else {
        toast.success(
          "Claim submitted successfully with all documents validated.",
        );
      }
      onNavigate?.("claims");
    }, 800);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-hp-blue to-hp-navy rounded-2xl px-6 py-5 flex items-center gap-4">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15 shrink-0">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-xl tracking-tight">
              Claim Validation
            </h1>
            <span className="text-[10px] bg-emerald-400 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
              Module 5A
            </span>
          </div>
          <p className="text-white/70 text-xs mt-0.5">
            Upload claim documents · Auto-match checklist · Submit with
            confidence
          </p>
        </div>
        {selectedClaimId && (
          <div className="ml-auto shrink-0">
            <ValidationStatusBadge status={status} />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-3 space-y-5">
          {/* Case Type Selector */}
          <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-hp-muted mb-3">
              Case Type
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-ocid="validation.case_type.surgical"
                onClick={() => setCaseType("surgical")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  caseType === "surgical"
                    ? "border-hp-blue bg-hp-blue/5 shadow-sm"
                    : "border-hp-border bg-white hover:border-hp-blue/40",
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    caseType === "surgical" ? "bg-hp-blue/10" : "bg-hp-bg",
                  )}
                >
                  <FileText
                    className={cn(
                      "h-6 w-6",
                      caseType === "surgical"
                        ? "text-hp-blue"
                        : "text-hp-muted",
                    )}
                  />
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "font-bold text-sm",
                      caseType === "surgical" ? "text-hp-blue" : "text-hp-body",
                    )}
                  >
                    Surgical Case
                  </p>
                  <p className="text-[10px] text-hp-muted mt-0.5">
                    8 required documents
                  </p>
                </div>
                {caseType === "surgical" && (
                  <CheckCircle2 className="h-4 w-4 text-hp-blue" />
                )}
              </button>
              <button
                type="button"
                data-ocid="validation.case_type.medical"
                onClick={() => setCaseType("medical")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  caseType === "medical"
                    ? "border-hp-blue bg-hp-blue/5 shadow-sm"
                    : "border-hp-border bg-white hover:border-hp-blue/40",
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    caseType === "medical" ? "bg-hp-blue/10" : "bg-hp-bg",
                  )}
                >
                  <FileImage
                    className={cn(
                      "h-6 w-6",
                      caseType === "medical" ? "text-hp-blue" : "text-hp-muted",
                    )}
                  />
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "font-bold text-sm",
                      caseType === "medical" ? "text-hp-blue" : "text-hp-body",
                    )}
                  >
                    Medical Management
                  </p>
                  <p className="text-[10px] text-hp-muted mt-0.5">
                    8 mandatory + 2 conditional
                  </p>
                </div>
                {caseType === "medical" && (
                  <CheckCircle2 className="h-4 w-4 text-hp-blue" />
                )}
              </button>
            </div>
          </div>

          {/* Claim Search */}
          <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-hp-muted mb-3">
              Link to Claim (Optional)
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
              <Input
                data-ocid="validation.claim_search.input"
                placeholder="Search patient name or claim ID..."
                value={claimSearch}
                onChange={(e) => handleClaimSearch(e.target.value)}
                className="pl-8 text-sm border-hp-border"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-hp-muted" />
              )}
              {claimSearchResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-hp-border rounded-xl shadow-lg overflow-hidden">
                  {claimSearchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      data-ocid="validation.claim_search.result"
                      onClick={() => selectClaim(c)}
                      className="w-full text-left px-4 py-3 hover:bg-hp-bg transition-colors border-b border-hp-border last:border-0"
                    >
                      <p className="text-sm font-semibold text-hp-body">
                        {c.patientName}
                      </p>
                      <p className="text-xs text-hp-muted">
                        {c.id}
                        {c.admissionDate
                          ? ` · Admitted: ${c.admissionDate}`
                          : ""}
                        {c.status ? ` · ${c.status}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedClaim && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-hp-body truncate">
                    {selectedClaim.patientName}
                  </p>
                  <p className="text-xs text-hp-muted">
                    Claim ID:{" "}
                    <span className="font-mono">{selectedClaim.id}</span>
                    {selectedClaim.admissionDate
                      ? ` · Admitted: ${selectedClaim.admissionDate}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClaim(null);
                    setSelectedClaimId(null);
                    setClaimSearch("");
                    setUploadedFiles([]);
                  }}
                  className="text-hp-muted hover:text-red-500 transition-colors"
                  aria-label="Clear claim selection"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Upload Zone */}
          <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-hp-muted mb-3">
              Upload Documents
            </p>
            <UploadZoneWrapper
              checklist={checklist}
              onFilesAdded={handleFilesAdded}
            />
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-hp-border bg-hp-bg/50 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-hp-muted">
                  Uploaded Files
                </p>
                <Badge variant="outline" className="text-xs border-hp-border">
                  {uploadedFiles.length} file
                  {uploadedFiles.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="divide-y divide-hp-border">
                {uploadedFiles.map((file, idx) => {
                  const matchedItem = checklist.find(
                    (i) => i.id === file.matchedItemId,
                  );
                  return (
                    <div
                      key={file.id}
                      data-ocid={`validation.file.item.${idx + 1}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-hp-bg/30 transition-colors"
                    >
                      <FileTypeIcon type={file.type} name={file.name} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium text-hp-body truncate"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-hp-muted">
                            {formatFileSize(file.size)} ·{" "}
                            {new Date(file.uploadedAt).toLocaleTimeString()}
                          </span>
                          {matchedItem ? (
                            <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0 rounded-full">
                              ✓ {matchedItem.name.slice(0, 30)}
                              {matchedItem.name.length > 30 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0 rounded-full">
                              Unmatched
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-ocid={`validation.file.item.${idx + 1}.delete_button`}
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1.5 text-hp-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        aria-label="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Checklist + Stats */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats Bar */}
          <div className="bg-white rounded-xl border border-hp-border p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-hp-muted">
                Validation Status
              </p>
              <ValidationStatusBadge
                status={uploadedFiles.length === 0 ? "NotValidated" : status}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-hp-muted">Mandatory docs matched</span>
                <span
                  className={cn(
                    "font-bold",
                    mandatoryMatched === totalRequired
                      ? "text-green-700"
                      : "text-red-600",
                  )}
                >
                  {mandatoryMatched} / {totalRequired}
                </span>
              </div>
              <Progress
                value={
                  totalRequired > 0
                    ? (mandatoryMatched / totalRequired) * 100
                    : 0
                }
                className="h-2.5 rounded-full"
              />
              {uploadedFiles.length > 0 && missingMandatory.length > 0 && (
                <p className="text-xs text-red-600 font-medium">
                  ⚠ {missingMandatory.length} mandatory document
                  {missingMandatory.length > 1 ? "s" : ""} missing
                </p>
              )}
              {uploadedFiles.length > 0 && missingConditional.length > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  ! {missingConditional.length} conditional document
                  {missingConditional.length > 1 ? "s" : ""} not found
                </p>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-hp-border bg-hp-bg/50">
              <p className="text-xs font-bold uppercase tracking-wide text-hp-muted">
                {caseType === "surgical" ? "Surgical" : "Medical Management"}{" "}
                Checklist
              </p>
            </div>
            <div className="divide-y divide-hp-border">
              {checklist.map((item) => {
                const matched = matchedItemIds.has(item.id);
                const matchingFiles = uploadedFiles.filter(
                  (f) => f.matchedItemId === item.id,
                );
                return (
                  <div
                    key={item.id}
                    data-ocid={`validation.checklist.item.${item.id}`}
                    className={cn(
                      "px-4 py-3 transition-colors",
                      matched
                        ? "bg-green-50/40"
                        : item.required === "Mandatory"
                          ? "bg-red-50/20"
                          : "bg-amber-50/20",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {matched ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle
                            className={cn(
                              "h-4 w-4",
                              item.required === "Mandatory"
                                ? "text-red-400"
                                : "text-amber-400",
                            )}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-xs font-semibold leading-snug",
                            matched ? "text-green-800" : "text-hp-body",
                          )}
                        >
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            className={cn(
                              "text-[10px] px-1.5 py-0 rounded-full border font-semibold",
                              item.required === "Mandatory"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : item.required === "Conditional"
                                  ? "bg-amber-50 text-amber-600 border-amber-200"
                                  : "bg-gray-50 text-gray-500 border-gray-200",
                            )}
                          >
                            {item.required}
                          </Badge>
                          {matched ? (
                            <span className="text-[10px] text-green-700 font-medium">
                              {matchingFiles.map((f) => f.name).join(", ")}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                item.required === "Mandatory"
                                  ? "text-red-500"
                                  : "text-amber-500",
                              )}
                            >
                              Missing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Claim Button */}
          {selectedClaimId && (
            <Button
              data-ocid="validation.submit_claim.button"
              onClick={handleSubmitClaim}
              disabled={isSubmitting}
              className={cn(
                "w-full h-11 font-bold rounded-xl text-sm transition-all",
                status === "Pass"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : status === "Pass" ? (
                <ShieldCheck className="h-4 w-4 mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              {isSubmitting
                ? "Submitting..."
                : status === "Pass"
                  ? "Submit Claim (All Docs Verified)"
                  : "Submit Claim (with Warning)"}
            </Button>
          )}

          {/* Tip box */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1.5">
              💡 Filename Tips for Auto-Matching
            </p>
            <ul className="space-y-0.5">
              {[
                "Include keywords like 'discharge', 'hpe', 'anesthesia' in filenames",
                "Use 'ot_photo' or 'intra-ot' for OT images",
                "Name ICU files with 'icu_chart' or 'icps'",
                "Label prescriptions as 'prescription' or 'rx'",
              ].map((tip) => (
                <li
                  key={tip}
                  className="text-[11px] text-blue-700 flex items-start gap-1.5"
                >
                  <span className="mt-1 h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <WarningModal
        open={warningModalOpen}
        missingMandatory={missingMandatory}
        missingConditional={missingConditional}
        onProceed={() => proceedSubmit(true)}
        onCancel={() => setWarningModalOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: read validation record for a given claimId (used by ClaimsModule)
// ---------------------------------------------------------------------------
export { loadValidationRecord };
export type { ValidationStatus, ClaimValidationRecord };
