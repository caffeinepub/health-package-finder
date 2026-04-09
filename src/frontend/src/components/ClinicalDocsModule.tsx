import type {
  ClinicalDocChecklistItem,
  ClinicalDocRecord,
  ClinicalDocRequest,
  DocChecklistItem,
  backendInterface as FullBackendInterface,
  Patient,
  PreAuthRequest,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { HealthPackage } from "./GenerateNotesModal";
import { WorkflowBanner } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Per-Package Upload Types
// ---------------------------------------------------------------------------

interface UploadedDocFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  packageCode: string;
  dataUrl: string;
}

function lsKey(tempDocId: string, packageCode: string) {
  return `clinicaldoc_files_${tempDocId}_${packageCode}`;
}

function loadFilesFromLS(
  tempDocId: string,
  packageCode: string,
): UploadedDocFile[] {
  try {
    const raw = localStorage.getItem(lsKey(tempDocId, packageCode));
    if (!raw) return [];
    return JSON.parse(raw) as UploadedDocFile[];
  } catch {
    return [];
  }
}

function saveFilesToLS(
  tempDocId: string,
  packageCode: string,
  files: UploadedDocFile[],
) {
  try {
    localStorage.setItem(lsKey(tempDocId, packageCode), JSON.stringify(files));
  } catch {
    // storage full — silently skip
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function autoMatchFile(fileName: string, docName: string): boolean {
  const nameLower = fileName.toLowerCase().replace(/[\s._-]/g, "");
  const words = docName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  return words.some((w) => nameLower.includes(w));
}

// ---------------------------------------------------------------------------
// Per-Package Upload Section
// ---------------------------------------------------------------------------

function PerPackageUploadSection({
  pkg,
  tempDocId,
  onChecklistAutoUpdate,
}: {
  pkg: HealthPackage;
  tempDocId: string;
  onChecklistAutoUpdate: (
    packageCode: string,
    matchedDocNames: string[],
  ) => void;
}) {
  const [files, setFiles] = useState<UploadedDocFile[]>(() =>
    loadFilesFromLS(tempDocId, pkg.packageCode),
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preAuthDocs = parseSemicolon(pkg.preAuthDocument ?? "");
  const claimDocs = parseSemicolon(pkg.claimDocument ?? "");
  const allDocNames = Array.from(new Set([...preAuthDocs, ...claimDocs]));
  const totalDocs = allDocNames.length;

  // Compute completion color
  const checkedCount = allDocNames.filter((docName) =>
    files.some((f) => autoMatchFile(f.name, docName)),
  ).length;
  const pct = totalDocs > 0 ? checkedCount / totalDocs : 1;
  const headerColor =
    pct === 1
      ? "border-green-300 bg-green-50"
      : pct >= 0.5
        ? "border-amber-300 bg-amber-50"
        : "border-red-300 bg-red-50";
  const badgeColor =
    pct === 1
      ? "bg-green-100 text-green-700 border-green-300"
      : pct >= 0.5
        ? "bg-amber-100 text-amber-700 border-amber-300"
        : "bg-red-100 text-red-700 border-red-300";

  function persistAndUpdate(next: UploadedDocFile[]) {
    setFiles(next);
    saveFilesToLS(tempDocId, pkg.packageCode, next);
    const matched = allDocNames.filter((docName) =>
      next.some((f) => autoMatchFile(f.name, docName)),
    );
    onChecklistAutoUpdate(pkg.packageCode, matched);
  }

  function processFiles(rawFiles: File[]) {
    const readers = rawFiles.map(
      (file) =>
        new Promise<UploadedDocFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: file.name,
              size: file.size,
              type: file.type,
              uploadedAt: new Date().toISOString(),
              packageCode: pkg.packageCode,
              dataUrl: e.target?.result as string,
            });
          };
          reader.readAsDataURL(file);
        }),
    );
    Promise.all(readers).then((newFiles) => {
      const next = [...files, ...newFiles];
      persistAndUpdate(next);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) processFiles(dropped);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) processFiles(selected);
    e.target.value = "";
  }

  function deleteFile(fileId: string) {
    const next = files.filter((f) => f.id !== fileId);
    persistAndUpdate(next);
  }

  function downloadFile(file: UploadedDocFile) {
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  }

  return (
    <div
      data-ocid={`clinicaldocs.pkg_upload.card.${pkg.packageCode}`}
      className={cn(
        "rounded-xl border-2 overflow-hidden transition-colors",
        headerColor,
      )}
    >
      {/* Card Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
      >
        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/70 border border-current/20 shrink-0">
          <Upload className="h-3.5 w-3.5 text-hp-blue" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-hp-blue bg-white/70 border border-hp-blue/20 px-1.5 py-0.5 rounded">
              {pkg.packageCode}
            </span>
            <span className="text-sm font-semibold text-hp-body truncate">
              {pkg.packageName}
            </span>
          </div>
          <p className="text-xs text-hp-muted mt-0.5">
            {pkg.speciality} · {files.length} file
            {files.length !== 1 ? "s" : ""} uploaded · {checkedCount}/
            {totalDocs} docs matched
          </p>
        </div>
        <Badge
          className={cn(
            "text-[10px] border rounded-full px-2.5 py-0.5 font-semibold shrink-0",
            badgeColor,
          )}
        >
          {pct === 1 ? "Complete" : pct >= 0.5 ? "Partial" : "Incomplete"}
        </Badge>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-hp-muted shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-hp-muted shrink-0" />
        )}
      </button>

      {/* Expanded Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="bg-white border-t-2 border-current/10 px-4 py-4 space-y-4">
              {/* Document Lists */}
              <div className="grid sm:grid-cols-2 gap-4">
                {preAuthDocs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-hp-muted mb-1.5">
                      Pre-Auth Documents ({preAuthDocs.length})
                    </p>
                    <ul className="space-y-1">
                      {preAuthDocs.map((doc) => {
                        const matched = files.some((f) =>
                          autoMatchFile(f.name, doc),
                        );
                        return (
                          <li
                            key={doc}
                            className={cn(
                              "flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg border",
                              matched
                                ? "bg-green-50 border-green-200 text-green-800"
                                : "bg-red-50/40 border-red-100 text-hp-body",
                            )}
                          >
                            {matched ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-snug">{doc}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {claimDocs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-hp-muted mb-1.5">
                      Claim Documents ({claimDocs.length})
                    </p>
                    <ul className="space-y-1">
                      {claimDocs.map((doc) => {
                        const matched = files.some((f) =>
                          autoMatchFile(f.name, doc),
                        );
                        return (
                          <li
                            key={doc}
                            className={cn(
                              "flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg border",
                              matched
                                ? "bg-green-50 border-green-200 text-green-800"
                                : "bg-gray-50 border-hp-border text-hp-body",
                            )}
                          >
                            {matched ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-hp-muted shrink-0 mt-0.5" />
                            )}
                            <span className="leading-snug">{doc}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Drop Zone */}
              <button
                type="button"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-ocid={`clinicaldocs.pkg_upload.dropzone.${pkg.packageCode}`}
                className={cn(
                  "w-full border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all",
                  isDragOver
                    ? "border-hp-blue bg-hp-blue/5 scale-[1.01]"
                    : "border-hp-border hover:border-hp-blue/50 hover:bg-hp-bg/60",
                )}
              >
                <Upload
                  className={cn(
                    "h-7 w-7 mx-auto mb-2 transition-colors",
                    isDragOver ? "text-hp-blue" : "text-hp-muted/50",
                  )}
                />
                <p className="text-sm font-semibold text-hp-body">
                  {isDragOver
                    ? "Drop files here"
                    : "Drag & drop files or click to browse"}
                </p>
                <p className="text-xs text-hp-muted mt-1">
                  PDF, JPG, PNG, DOC, DOCX, XLS — any file type accepted
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.gif,.webp"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </button>

              {/* Uploaded Files Table */}
              {files.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-hp-muted mb-2">
                    Uploaded Files ({files.length})
                  </p>
                  <div className="rounded-lg border border-hp-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-hp-bg border-b border-hp-border">
                          <th className="text-left px-3 py-2 text-hp-muted font-semibold">
                            File Name
                          </th>
                          <th className="text-right px-3 py-2 text-hp-muted font-semibold hidden sm:table-cell">
                            Size
                          </th>
                          <th className="text-right px-3 py-2 text-hp-muted font-semibold hidden md:table-cell">
                            Uploaded
                          </th>
                          <th className="text-right px-3 py-2 text-hp-muted font-semibold w-16">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((file) => {
                          const isMatched = allDocNames.some((doc) =>
                            autoMatchFile(file.name, doc),
                          );
                          return (
                            <tr
                              key={file.id}
                              className="border-b border-hp-border last:border-0 hover:bg-hp-bg/50 transition-colors"
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isMatched && (
                                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                  )}
                                  <span className="font-medium text-hp-body truncate max-w-[200px]">
                                    {file.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-hp-muted hidden sm:table-cell tabular-nums">
                                {formatFileSize(file.size)}
                              </td>
                              <td className="px-3 py-2 text-right text-hp-muted hidden md:table-cell">
                                {new Date(file.uploadedAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    data-ocid={`clinicaldocs.pkg_upload.download.${pkg.packageCode}`}
                                    onClick={() => downloadFile(file)}
                                    className="p-1 rounded hover:bg-blue-50 text-hp-muted hover:text-hp-blue transition-colors"
                                    title="Download"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    data-ocid={`clinicaldocs.pkg_upload.delete.${pkg.packageCode}`}
                                    onClick={() => deleteFile(file.id)}
                                    className="p-1 rounded hover:bg-red-50 text-hp-muted hover:text-red-500 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERAL_CLINICAL_DOCS: ClinicalDocChecklistItem[] = [
  {
    docName: "Doctor's Notes / Admission Note",
    packageCode: "GENERAL",
    required: true,
    submitted: false,
    docType: "clinical",
  },
  {
    docName: "Discharge Summary",
    packageCode: "GENERAL",
    required: true,
    submitted: false,
    docType: "clinical",
  },
  {
    docName: "Operative Notes (if surgical)",
    packageCode: "GENERAL",
    required: false,
    submitted: false,
    docType: "clinical",
  },
  {
    docName: "Anesthesia Record (if surgical)",
    packageCode: "GENERAL",
    required: false,
    submitted: false,
    docType: "clinical",
  },
  {
    docName: "Investigation Reports / Lab Results",
    packageCode: "GENERAL",
    required: true,
    submitted: false,
    docType: "clinical",
  },
  {
    docName: "Nursing Notes",
    packageCode: "GENERAL",
    required: false,
    submitted: false,
    docType: "clinical",
  },
];

const FILTER_STATUSES = ["All", "Draft", "InReview", "Complete"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSemicolon(val: string): string[] {
  if (!val || val.toLowerCase() === "no" || val.toLowerCase() === "none")
    return [];
  return val
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

function buildChecklistFromPackages(
  packages: HealthPackage[],
): ClinicalDocChecklistItem[] {
  // Map: docName -> item (deduplicated, packageCode accumulates)
  const map = new Map<string, ClinicalDocChecklistItem>();

  for (const pkg of packages) {
    const preDocs = parseSemicolon(pkg.preAuthDocument ?? "");
    const claimDocs = parseSemicolon(pkg.claimDocument ?? "");

    for (const doc of preDocs) {
      const key = doc.toLowerCase();
      if (map.has(key)) {
        const existing = map.get(key)!;
        if (!existing.packageCode.includes(pkg.packageCode)) {
          map.set(key, {
            ...existing,
            packageCode: `${existing.packageCode}, ${pkg.packageCode}`,
          });
        }
      } else {
        map.set(key, {
          docName: doc,
          packageCode: pkg.packageCode,
          required: true,
          submitted: false,
          docType: "preauth",
        });
      }
    }

    for (const doc of claimDocs) {
      const key = `${doc.toLowerCase()}__claim`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        if (!existing.packageCode.includes(pkg.packageCode)) {
          map.set(key, {
            ...existing,
            packageCode: `${existing.packageCode}, ${pkg.packageCode}`,
          });
        }
      } else {
        // If same doc already exists as preauth, append packageCode there
        const preauthKey = doc.toLowerCase();
        if (map.has(preauthKey)) {
          const existing = map.get(preauthKey)!;
          if (!existing.packageCode.includes(pkg.packageCode)) {
            map.set(preauthKey, {
              ...existing,
              packageCode: `${existing.packageCode}, ${pkg.packageCode}`,
            });
          }
        } else {
          map.set(key, {
            docName: doc,
            packageCode: pkg.packageCode,
            required: true,
            submitted: false,
            docType: "claim",
          });
        }
      }
    }
  }

  const packageDocs = Array.from(map.values());

  // Merge with general clinical docs (deduplicate by docName)
  const merged: ClinicalDocChecklistItem[] = [...packageDocs];
  for (const gen of GENERAL_CLINICAL_DOCS) {
    const alreadyExists = merged.some(
      (d) => d.docName.toLowerCase() === gen.docName.toLowerCase(),
    );
    if (!alreadyExists) {
      merged.push(gen);
    }
  }

  return merged;
}

function getMissingStats(checklist: ClinicalDocChecklistItem[]) {
  const required = checklist.filter((d) => d.required);
  const optional = checklist.filter((d) => !d.required);
  const submittedRequired = required.filter((d) => d.submitted).length;
  const submittedOptional = optional.filter((d) => d.submitted).length;
  const missingRequired = required.length - submittedRequired;
  const missingOptional = optional.length - submittedOptional;
  return {
    totalRequired: required.length,
    submittedRequired,
    missingRequired,
    missingOptional,
    totalOptional: optional.length,
    submittedOptional,
  };
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    Draft: {
      label: "Draft",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    },
    InReview: {
      label: "In Review",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    Complete: {
      label: "Complete",
      cls: "bg-green-100 text-green-700 border-green-200",
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
// Section Card
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
// Missing Document Status Bar
// ---------------------------------------------------------------------------

function MissingDocBar({
  checklist,
}: {
  checklist: ClinicalDocChecklistItem[];
}) {
  const stats = getMissingStats(checklist);

  if (checklist.length === 0) return null;

  let barColor = "bg-green-50 border-green-200";
  let textColor = "text-green-700";
  let iconColor = "text-green-500";
  let icon = <CheckCircle2 className="h-4 w-4" />;
  let message = "All required documents submitted — ready to proceed!";

  if (stats.missingRequired > 0) {
    barColor = "bg-red-50 border-red-200";
    textColor = "text-red-700";
    iconColor = "text-red-500";
    icon = <AlertCircle className="h-4 w-4" />;
    message = `${stats.missingRequired} of ${stats.totalRequired} required documents missing`;
  } else if (stats.missingOptional > 0) {
    barColor = "bg-amber-50 border-amber-200";
    textColor = "text-amber-700";
    iconColor = "text-amber-500";
    icon = <AlertCircle className="h-4 w-4" />;
    message = `${stats.missingOptional} optional document${stats.missingOptional > 1 ? "s" : ""} not yet submitted`;
  }

  const pct =
    stats.totalRequired > 0
      ? Math.round((stats.submittedRequired / stats.totalRequired) * 100)
      : 100;

  return (
    <div
      data-ocid="clinicaldocs.missing_doc.panel"
      className={cn(
        "sticky top-0 z-10 rounded-xl border p-3.5 flex items-center gap-3",
        barColor,
      )}
    >
      <span className={cn("shrink-0", iconColor)}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", textColor)}>{message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Progress value={pct} className="h-2 flex-1 rounded-full" />
          <span className="text-xs font-bold tabular-nums shrink-0">
            {stats.submittedRequired}/{stats.totalRequired} required
          </span>
        </div>
      </div>
      {stats.missingRequired === 0 && (
        <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs rounded-full px-2.5">
          Complete
        </Badge>
      )}
      {stats.missingRequired > 0 && (
        <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs rounded-full px-2.5">
          {stats.missingRequired} missing
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistGroupInteractive — uses index for toggle
// ---------------------------------------------------------------------------

function ChecklistGroupInteractive({
  title,
  items,
  allItems,
  onToggle,
}: {
  title: string;
  items: ClinicalDocChecklistItem[];
  allItems: ClinicalDocChecklistItem[];
  onToggle: (globalIndex: number) => void;
}) {
  if (items.length === 0) return null;
  const submitted = items.filter((d) => d.submitted).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-widest text-hp-muted">
          {title}
        </h4>
        <span className="text-xs text-hp-muted">
          {submitted}/{items.length} submitted
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const globalIdx = allItems.findIndex(
            (d) =>
              d.docName === item.docName &&
              d.packageCode === item.packageCode &&
              d.docType === item.docType,
          );
          return (
            <div
              key={`${item.docName}-${item.packageCode}-${item.docType}`}
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
                checked={item.submitted}
                onCheckedChange={() => onToggle(globalIdx)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium leading-snug",
                    item.submitted
                      ? "text-green-800 line-through"
                      : "text-hp-body",
                  )}
                >
                  {item.docName}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {item.packageCode !== "GENERAL" && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                      {item.packageCode}
                    </span>
                  )}
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 rounded-full border font-semibold",
                      item.required
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-gray-50 text-gray-500 border-gray-200",
                    )}
                  >
                    {item.required ? "Required" : "Optional"}
                  </Badge>
                </div>
              </div>
              {item.submitted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Document Set Tab
// ---------------------------------------------------------------------------

function NewDocumentSetForm({
  actor,
  onSuccess,
}: {
  actor: FullBackendInterface | null;
  onSuccess: () => void;
}) {
  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const patientSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Package search
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [selectedPackages, setSelectedPackages] = useState<HealthPackage[]>([]);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const packageDropdownRef = useRef<HTMLDivElement>(null);

  // Checklist & notes
  const [checklist, setChecklist] = useState<ClinicalDocChecklistItem[]>([]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [dischargeSummary, setDischargeSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-package file upload state
  const [tempDocId] = useState(() => `tmp_${Date.now()}`);

  // Load packages on mount
  useEffect(() => {
    fetch("/assets/packages.json")
      .then((r) => r.json())
      .then((data: HealthPackage[]) => setPackages(data))
      .catch(() => {});
  }, []);

  // Click outside to close package dropdown
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        packageDropdownRef.current &&
        !packageDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPackageDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Patient search with debounce
  const handlePatientSearchChange = useCallback(
    (value: string) => {
      setPatientSearch(value);
      setSelectedPatient(null);
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

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientSearch(p.name);
    setPatientResults([]);
  }

  // Filtered packages for dropdown
  const filteredPackages = packageSearch
    ? packages
        .filter(
          (p) =>
            !selectedPackages.some((s) => s.packageCode === p.packageCode) &&
            (p.packageCode
              .toLowerCase()
              .includes(packageSearch.toLowerCase()) ||
              p.packageName
                .toLowerCase()
                .includes(packageSearch.toLowerCase())),
        )
        .slice(0, 12)
    : [];

  function addPackage(pkg: HealthPackage) {
    const next = [...selectedPackages, pkg];
    setSelectedPackages(next);
    setPackageSearch("");
    setShowPackageDropdown(false);
    // Rebuild checklist
    setChecklist(buildChecklistFromPackages(next));
  }

  function removePackage(code: string) {
    const next = selectedPackages.filter((p) => p.packageCode !== code);
    setSelectedPackages(next);
    if (next.length === 0) {
      setChecklist([]);
    } else {
      setChecklist(buildChecklistFromPackages(next));
    }
  }

  function toggleChecklist(index: number) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, submitted: !item.submitted } : item,
      ),
    );
  }

  // Auto-update checklist submission status when files are uploaded
  function handleChecklistAutoUpdate(
    packageCode: string,
    matchedDocNames: string[],
  ) {
    // Auto-check matching checklist items
    setChecklist((prev) =>
      prev.map((item) => {
        const belongsToPackage =
          item.packageCode === packageCode ||
          item.packageCode.includes(packageCode);
        if (!belongsToPackage) return item;
        const autoMatched = matchedDocNames.some(
          (dn) => dn.toLowerCase() === item.docName.toLowerCase(),
        );
        if (autoMatched && !item.submitted) {
          return { ...item, submitted: true };
        }
        return item;
      }),
    );
  }

  const preAuthDocs = checklist.filter((d) => d.docType === "preauth");
  const claimDocs = checklist.filter((d) => d.docType === "claim");
  const clinicalDocs = checklist.filter((d) => d.docType === "clinical");

  async function handleSubmit() {
    if (!selectedPatient || selectedPackages.length === 0 || !actor) return;
    setIsSubmitting(true);
    const req: ClinicalDocRequest = {
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      packageCodes: selectedPackages.map((p) => p.packageCode),
      packageNames: selectedPackages.map((p) => p.packageName),
      doctorNotes,
      dischargeSummary,
      documentChecklist: checklist,
    };
    try {
      const result = await actor.createClinicalDoc(req);
      if ("ok" in result) {
        toast.success("Clinical documentation set created successfully");
        // Reset form
        setSelectedPatient(null);
        setPatientSearch("");
        setSelectedPackages([]);
        setChecklist([]);
        setDoctorNotes("");
        setDischargeSummary("");
        onSuccess();
      } else {
        toast.error(`Failed: ${result.err}`);
      }
    } catch {
      toast.error("Error creating clinical documentation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Missing Doc Status Bar */}
      {checklist.length > 0 && <MissingDocBar checklist={checklist} />}

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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
                <Input
                  data-ocid="clinicaldocs.patient.search_input"
                  placeholder="Type patient name or ID..."
                  value={patientSearch}
                  onChange={(e) => handlePatientSearchChange(e.target.value)}
                  className="pl-8 text-sm border-hp-border"
                />
                {isSearchingPatient && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-hp-muted" />
                )}
              </div>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-hp-muted">Name: </span>
                  <span className="font-semibold text-hp-body">
                    {selectedPatient.name}
                  </span>
                </div>
                <div>
                  <span className="text-hp-muted">DOB: </span>
                  <span className="font-semibold text-hp-body">
                    {selectedPatient.dob}
                  </span>
                </div>
                <div>
                  <span className="text-hp-muted">Payer: </span>
                  <span className="font-semibold text-hp-body">
                    {selectedPatient.payerName || selectedPatient.payerType}
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
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                }}
                className="text-hp-muted hover:text-hp-body transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Package Code Multi-Select */}
      <SectionCard
        title="Package Code Selection"
        icon={<FileText className="h-4 w-4" />}
        badge={
          selectedPackages.length > 0 ? (
            <Badge className="bg-hp-blue/10 text-hp-blue border border-hp-blue/20 text-xs rounded-full">
              {selectedPackages.length} selected
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <FieldRow label="Search & Select Package Codes" required>
            <div className="relative" ref={packageDropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
                <Input
                  data-ocid="clinicaldocs.package.search_input"
                  placeholder="Type package code or name..."
                  value={packageSearch}
                  onChange={(e) => {
                    setPackageSearch(e.target.value);
                    setShowPackageDropdown(true);
                  }}
                  onFocus={() => {
                    if (packageSearch) setShowPackageDropdown(true);
                  }}
                  className="pl-8 text-sm border-hp-border"
                />
              </div>
              {showPackageDropdown && filteredPackages.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-hp-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {filteredPackages.map((p) => (
                    <button
                      key={p.packageCode}
                      type="button"
                      onClick={() => addPackage(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-hp-bg transition-colors border-b border-hp-border last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-hp-blue/10 text-hp-blue px-1.5 py-0.5 rounded shrink-0">
                          {p.packageCode}
                        </span>
                        <span className="text-sm text-hp-body truncate">
                          {p.packageName}
                        </span>
                      </div>
                      <p className="text-xs text-hp-muted mt-0.5">
                        {p.speciality} · {p.category}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FieldRow>

          {/* Selected Package Chips */}
          {selectedPackages.length > 0 && (
            <div
              data-ocid="clinicaldocs.packages.list"
              className="flex flex-wrap gap-2"
            >
              {selectedPackages.map((p, idx) => (
                <div
                  key={p.packageCode}
                  data-ocid={`clinicaldocs.packages.item.${idx + 1}`}
                  className="flex items-center gap-1.5 bg-hp-blue/8 border border-hp-blue/25 text-hp-blue rounded-full px-3 py-1.5 text-xs font-semibold"
                >
                  <span className="font-mono">{p.packageCode}</span>
                  <span className="text-hp-muted font-normal hidden sm:inline truncate max-w-[12rem]">
                    — {p.packageName}
                  </span>
                  <button
                    type="button"
                    data-ocid={`clinicaldocs.packages.delete_button.${idx + 1}`}
                    onClick={() => removePackage(p.packageCode)}
                    className="ml-0.5 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedPackages.length === 0 && (
            <p className="text-xs text-hp-muted">
              Search and select one or more package codes. The document
              checklist will be auto-generated.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Per-Package Document Upload Sections */}
      {selectedPackages.length > 0 && (
        <SectionCard
          title="Upload Documents by Package"
          icon={<Upload className="h-4 w-4" />}
          badge={
            <span className="text-xs text-hp-muted">
              {selectedPackages.length} package
              {selectedPackages.length !== 1 ? "s" : ""}
            </span>
          }
        >
          <div className="space-y-3">
            {selectedPackages.map((pkg) => (
              <PerPackageUploadSection
                key={pkg.packageCode}
                pkg={pkg}
                tempDocId={tempDocId}
                onChecklistAutoUpdate={handleChecklistAutoUpdate}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Document Checklist */}
      {checklist.length > 0 && (
        <SectionCard
          title="Document Checklist"
          icon={<CheckCircle2 className="h-4 w-4" />}
          badge={
            <span className="text-xs text-hp-muted">
              {checklist.filter((d) => d.submitted).length}/{checklist.length}
              &nbsp;submitted
            </span>
          }
        >
          <div className="space-y-5">
            {preAuthDocs.length > 0 && (
              <ChecklistGroupInteractive
                title="Pre-Authorization Documents"
                items={preAuthDocs}
                allItems={checklist}
                onToggle={toggleChecklist}
              />
            )}
            {claimDocs.length > 0 && (
              <ChecklistGroupInteractive
                title="Claim Documents"
                items={claimDocs}
                allItems={checklist}
                onToggle={toggleChecklist}
              />
            )}
            {clinicalDocs.length > 0 && (
              <ChecklistGroupInteractive
                title="Clinical Documents"
                items={clinicalDocs}
                allItems={checklist}
                onToggle={toggleChecklist}
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* Doctor Notes & Discharge Summary */}
      <SectionCard
        title="Clinical Notes"
        icon={<FileText className="h-4 w-4" />}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <FieldRow label="Doctor Notes / Admission Note">
            <Textarea
              data-ocid="clinicaldocs.doctor_notes.textarea"
              placeholder="Enter doctor's notes, clinical findings, diagnosis details..."
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              rows={5}
              className="text-sm border-hp-border resize-none"
            />
          </FieldRow>
          <FieldRow label="Discharge Summary">
            <Textarea
              data-ocid="clinicaldocs.discharge_summary.textarea"
              placeholder="Enter discharge summary, condition at discharge, follow-up instructions..."
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              rows={5}
              className="text-sm border-hp-border resize-none"
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          data-ocid="clinicaldocs.submit.primary_button"
          onClick={handleSubmit}
          disabled={
            !selectedPatient ||
            selectedPackages.length === 0 ||
            isSubmitting ||
            !actor
          }
          className="bg-hp-blue text-white font-bold hover:bg-hp-navy rounded-xl px-8"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {isSubmitting ? "Creating..." : "Create Document Set"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send to Pre-Auth Dialog
// ---------------------------------------------------------------------------

function SendToPreAuthDialog({
  record,
  actor,
  open,
  onOpenChange,
}: {
  record: ClinicalDocRecord;
  actor: FullBackendInterface | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [diagnosisName, setDiagnosisName] = useState("");
  const [schemeType, setSchemeType] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [expectedTATHours, setExpectedTATHours] = useState("48");
  const [checklist, setChecklist] = useState<DocChecklistItem[]>(
    record.documentChecklist.map((item) => ({
      docName: item.docName,
      required: item.required,
      submitted: item.submitted,
    })),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successPreAuthId, setSuccessPreAuthId] = useState<string | null>(null);

  function resetForm() {
    setDiagnosisName("");
    setSchemeType("");
    setRequestedAmount("");
    setExpectedTATHours("48");
    setChecklist(
      record.documentChecklist.map((item) => ({
        docName: item.docName,
        required: item.required,
        submitted: item.submitted,
      })),
    );
    setSuccessPreAuthId(null);
  }

  function handleOpenChange(val: boolean) {
    if (!val) resetForm();
    onOpenChange(val);
  }

  function toggleChecklistItem(index: number) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, submitted: !item.submitted } : item,
      ),
    );
  }

  async function handleSubmit() {
    if (!actor || !diagnosisName || !schemeType) {
      toast.error("Please fill in required fields");
      return;
    }
    setIsSubmitting(true);
    const req: PreAuthRequest = {
      patientId: record.patientId,
      patientName: record.patientName,
      packageCode: record.packageCodes[0] ?? "",
      packageName: record.packageNames[0] ?? "",
      diagnosisName,
      schemeType,
      payerName: "",
      requestedAmount,
      expectedTATHours: BigInt(Number.parseInt(expectedTATHours, 10) || 48),
      documentChecklist: checklist,
    };
    try {
      const result = await actor.createPreAuth(req);
      if ("ok" in result) {
        setSuccessPreAuthId(result.ok);
        toast.success(`Pre-Auth created: ${result.ok}`);
      } else {
        toast.error(`Failed: ${result.err}`);
      }
    } catch {
      toast.error("Error creating pre-authorization");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-ocid="clinicaldocs.send_preauth.dialog"
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-hp-body">
            <Send className="h-4 w-4 text-hp-blue" />
            Send to Pre-Authorization
          </DialogTitle>
        </DialogHeader>

        {successPreAuthId ? (
          <div
            data-ocid="clinicaldocs.send_preauth.success_state"
            className="py-6 text-center space-y-4"
          >
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mx-auto">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-hp-body text-lg">
                Pre-Auth Created!
              </p>
              <p className="text-sm text-hp-muted mt-1">
                Pre-Authorization has been successfully created.
              </p>
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 inline-block">
                <p className="text-xs text-hp-muted">Pre-Auth ID</p>
                <p className="font-mono font-bold text-green-700">
                  {successPreAuthId}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                data-ocid="clinicaldocs.send_preauth.close_button"
                onClick={() => handleOpenChange(false)}
                className="bg-hp-blue text-white hover:bg-hp-navy rounded-xl"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Patient & Packages (read-only) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="text-xs">
                <span className="text-hp-muted font-semibold uppercase tracking-wide">
                  Patient:
                </span>{" "}
                <span className="font-bold text-hp-body">
                  {record.patientName}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-hp-muted font-semibold uppercase tracking-wide">
                  Package Codes:
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {record.packageCodes.map((code, i) => (
                    <span
                      key={code}
                      className="font-mono bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-[10px]"
                    >
                      {code}
                      {record.packageNames[i]
                        ? ` — ${record.packageNames[i]}`
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
                  Diagnosis Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  data-ocid="clinicaldocs.send_preauth.diagnosis.input"
                  placeholder="e.g. Acute Appendicitis"
                  value={diagnosisName}
                  onChange={(e) => setDiagnosisName(e.target.value)}
                  className="text-sm border-hp-border"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
                  Scheme Type <span className="text-red-500">*</span>
                </Label>
                <Select value={schemeType} onValueChange={setSchemeType}>
                  <SelectTrigger
                    data-ocid="clinicaldocs.send_preauth.scheme.select"
                    className="text-sm border-hp-border"
                  >
                    <SelectValue placeholder="Select scheme..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "PMJAY",
                      "Ayushman Bharat",
                      "Private",
                      "Corporate",
                      "Other",
                    ].map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
                    Requested Amount (₹)
                  </Label>
                  <Input
                    data-ocid="clinicaldocs.send_preauth.amount.input"
                    placeholder="e.g. 45000"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="text-sm border-hp-border"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
                    Expected TAT (hours)
                  </Label>
                  <Input
                    data-ocid="clinicaldocs.send_preauth.tat.input"
                    type="number"
                    value={expectedTATHours}
                    onChange={(e) => setExpectedTATHours(e.target.value)}
                    className="text-sm border-hp-border"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Checklist */}
            {checklist.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-hp-muted mb-2">
                  Document Checklist (
                  {checklist.filter((d) => d.submitted).length}/
                  {checklist.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {checklist.map((item, i) => (
                    <div
                      key={item.docName}
                      className={cn(
                        "flex items-start gap-3 p-2.5 rounded-lg border transition-colors",
                        item.submitted
                          ? "bg-green-50 border-green-200"
                          : item.required
                            ? "bg-red-50/40 border-red-100"
                            : "bg-gray-50 border-hp-border",
                      )}
                    >
                      <Checkbox
                        data-ocid={`clinicaldocs.send_preauth.checklist.checkbox.${i + 1}`}
                        checked={item.submitted}
                        onCheckedChange={() => toggleChecklistItem(i)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p
                          className={cn(
                            "text-xs font-medium leading-snug",
                            item.submitted
                              ? "text-green-800 line-through"
                              : "text-hp-body",
                          )}
                        >
                          {item.docName}
                        </p>
                        <Badge
                          className={cn(
                            "text-[10px] mt-0.5 px-1.5 py-0 rounded-full border font-semibold",
                            item.required
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-gray-50 text-gray-500 border-gray-200",
                          )}
                        >
                          {item.required ? "Required" : "Optional"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                data-ocid="clinicaldocs.send_preauth.cancel_button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="border-hp-border"
              >
                Cancel
              </Button>
              <Button
                data-ocid="clinicaldocs.send_preauth.submit_button"
                onClick={handleSubmit}
                disabled={isSubmitting || !diagnosisName || !schemeType}
                className="bg-hp-blue text-white hover:bg-hp-navy rounded-xl"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isSubmitting ? "Sending..." : "Send to Pre-Auth"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Document Record Card (Tracker)
// ---------------------------------------------------------------------------

function DocRecordCard({
  record,
  index,
  actor,
  onRefresh,
}: {
  record: ClinicalDocRecord;
  index: number;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localChecklist, setLocalChecklist] = useState<
    ClinicalDocChecklistItem[]
  >([...record.documentChecklist]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [sendToPreAuthOpen, setSendToPreAuthOpen] = useState(false);

  const stats = getMissingStats(localChecklist);
  const pct =
    stats.totalRequired > 0
      ? Math.round((stats.submittedRequired / stats.totalRequired) * 100)
      : 100;

  async function handleToggle(idx: number) {
    const next = localChecklist.map((item, i) =>
      i === idx ? { ...item, submitted: !item.submitted } : item,
    );
    setLocalChecklist(next);
    if (!actor) return;
    setIsSaving(true);
    try {
      await actor.updateClinicalDoc(
        record.id,
        record.doctorNotes,
        record.dischargeSummary,
        next,
        record.status,
      );
    } catch {
      // Revert on error
      setLocalChecklist([...record.documentChecklist]);
      toast.error("Failed to update checklist");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusUpdate(newStatus: string) {
    if (!actor) return;
    setIsUpdatingStatus(true);
    try {
      const ok = await actor.updateClinicalDoc(
        record.id,
        record.doctorNotes,
        record.dischargeSummary,
        localChecklist,
        newStatus,
      );
      if (ok) {
        toast.success(`Status updated to ${newStatus}`);
        setStatusUpdate("");
        onRefresh();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const preAuthDocs = localChecklist.filter((d) => d.docType === "preauth");
  const claimDocs = localChecklist.filter((d) => d.docType === "claim");
  const clinicalDocs = localChecklist.filter((d) => d.docType === "clinical");

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        data-ocid={`clinicaldocs.tracker.item.${index + 1}`}
        className="bg-white rounded-xl border border-hp-border shadow-xs overflow-hidden"
      >
        {/* Card Header */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-hp-body">
                  {record.patientName}
                </p>
                <StatusBadge status={record.status} />
                {isSaving && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-hp-muted" />
                )}
              </div>
              <p className="text-xs text-hp-muted mt-0.5">
                {record.id} · {formatDateTime(record.createdAt)}
              </p>
            </div>
            {/* Missing badge */}
            {stats.missingRequired > 0 ? (
              <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs rounded-full px-2.5 shrink-0">
                {stats.missingRequired} missing
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs rounded-full px-2.5 shrink-0">
                Complete
              </Badge>
            )}
          </div>

          {/* Package Codes */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {record.packageCodes.map((code, i) => (
              <span
                key={code}
                className="text-[10px] font-mono bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded"
              >
                {code}
                {record.packageNames[i] ? ` — ${record.packageNames[i]}` : ""}
              </span>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-hp-muted">
              <span>
                {stats.submittedRequired}/{stats.totalRequired} required docs
                submitted
              </span>
              <span className="font-bold text-hp-body">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2 rounded-full" />
          </div>

          {/* Status Update, Send to Pre-Auth & Expand */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select
              value={statusUpdate}
              onValueChange={handleStatusUpdate}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger
                data-ocid={`clinicaldocs.tracker.select.${index + 1}`}
                className="h-8 text-xs border-hp-border w-36"
              >
                <SelectValue placeholder="Update status..." />
              </SelectTrigger>
              <SelectContent>
                {["Draft", "InReview", "Complete"].map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s === "InReview" ? "In Review" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpdatingStatus && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-hp-muted" />
            )}

            {/* Send to Pre-Auth Button */}
            <Button
              data-ocid={`clinicaldocs.tracker.send_preauth.button.${index + 1}`}
              size="sm"
              variant="outline"
              onClick={() => setSendToPreAuthOpen(true)}
              className="h-8 text-xs border-hp-blue/30 text-hp-blue hover:bg-hp-blue hover:text-white transition-colors"
            >
              <Send className="h-3 w-3 mr-1" />
              Send to Pre-Auth
            </Button>

            <button
              type="button"
              data-ocid={`clinicaldocs.tracker.toggle.${index + 1}`}
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
                  View Checklist
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expanded Checklist */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-hp-border overflow-hidden"
            >
              <div className="px-5 py-4 space-y-4 bg-hp-bg/40">
                {record.doctorNotes && (
                  <div className="text-xs">
                    <p className="font-semibold text-hp-muted uppercase tracking-wider mb-1">
                      Doctor Notes
                    </p>
                    <p className="text-hp-body bg-white border border-hp-border rounded-lg p-3 leading-relaxed">
                      {record.doctorNotes}
                    </p>
                  </div>
                )}
                {record.dischargeSummary && (
                  <div className="text-xs">
                    <p className="font-semibold text-hp-muted uppercase tracking-wider mb-1">
                      Discharge Summary
                    </p>
                    <p className="text-hp-body bg-white border border-hp-border rounded-lg p-3 leading-relaxed">
                      {record.dischargeSummary}
                    </p>
                  </div>
                )}
                {preAuthDocs.length > 0 && (
                  <ChecklistGroupInteractive
                    title="Pre-Auth Documents"
                    items={preAuthDocs}
                    allItems={localChecklist}
                    onToggle={handleToggle}
                  />
                )}
                {claimDocs.length > 0 && (
                  <ChecklistGroupInteractive
                    title="Claim Documents"
                    items={claimDocs}
                    allItems={localChecklist}
                    onToggle={handleToggle}
                  />
                )}
                {clinicalDocs.length > 0 && (
                  <ChecklistGroupInteractive
                    title="Clinical Documents"
                    items={clinicalDocs}
                    allItems={localChecklist}
                    onToggle={handleToggle}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Send to Pre-Auth Dialog */}
      <SendToPreAuthDialog
        record={record}
        actor={actor}
        open={sendToPreAuthOpen}
        onOpenChange={setSendToPreAuthOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Document Tracker Tab
// ---------------------------------------------------------------------------

function DocumentTrackerTab({
  records,
  isLoading,
  actor,
  onRefresh,
}: {
  records: ClinicalDocRecord[];
  isLoading: boolean;
  actor: FullBackendInterface | null;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.patientName.toLowerCase().includes(q) ||
      r.packageCodes.some((c) => c.toLowerCase().includes(q)) ||
      r.id.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hp-muted pointer-events-none" />
          <Input
            data-ocid="clinicaldocs.tracker.search_input"
            placeholder="Search by patient name or package code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm border-hp-border"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              data-ocid="clinicaldocs.tracker.filter.tab"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                statusFilter === s
                  ? "bg-hp-blue text-white border-hp-blue"
                  : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/40 hover:text-hp-body",
              )}
            >
              {s === "InReview" ? "In Review" : s}
              {s !== "All" && (
                <span className="ml-1 opacity-70">
                  ({records.filter((r) => r.status === s).length})
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            data-ocid="clinicaldocs.tracker.refresh.button"
            onClick={onRefresh}
            className="ml-auto p-1.5 rounded-lg text-hp-muted hover:text-hp-body hover:bg-hp-bg border border-hp-border transition-colors"
            title="Refresh records"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <div
          data-ocid="clinicaldocs.tracker.loading_state"
          className="flex items-center justify-center py-16 gap-3 text-hp-muted"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-ocid="clinicaldocs.tracker.empty_state"
          className="text-center py-16 text-hp-muted"
        >
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {records.length === 0
              ? "No clinical documentation records yet"
              : "No records match your filters"}
          </p>
          <p className="text-xs mt-1">
            {records.length === 0
              ? 'Create a new document set from the "New Document Set" tab'
              : "Try adjusting your search or filter"}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filtered.map((record, i) => (
              <DocRecordCard
                key={record.id}
                record={record}
                index={i}
                actor={actor}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function ClinicalDocsModule({
  onNavigate,
}: {
  onNavigate?: (page: string, data?: Record<string, unknown>) => void;
} = {}) {
  const { actor, isFetching } = useActor();
  const typedActor = actor as FullBackendInterface | null;

  const [activeTab, setActiveTab] = useState<"new" | "tracker">("new");
  const [records, setRecords] = useState<ClinicalDocRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!typedActor || isFetching) return;
    setIsLoadingRecords(true);
    try {
      const data = await typedActor.getClinicalDocs();
      setRecords(data);
    } catch {
      toast.error("Failed to load clinical documentation records");
    } finally {
      setIsLoadingRecords(false);
    }
  }, [typedActor, isFetching]);

  useEffect(() => {
    if (typedActor && !isFetching) {
      loadRecords();
    }
  }, [typedActor, isFetching, loadRecords]);

  function handleTabChange(value: string) {
    setActiveTab(value as "new" | "tracker");
    if (value === "tracker") {
      loadRecords();
    }
  }

  function handleNewDocSuccess() {
    setActiveTab("tracker");
    loadRecords();
  }

  const totalMissing = records.reduce((acc, r) => {
    const m = getMissingStats(r.documentChecklist);
    return acc + m.missingRequired;
  }, 0);

  return (
    <motion.main
      key="clinicaldocs"
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
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-xl tracking-tight">
                Clinical Documentation
              </h1>
              <span className="text-[10px] bg-emerald-400 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                Module 3
              </span>
            </div>
            <p className="text-white/70 text-xs mt-0.5">
              Strong documentation = zero rejection · ABDM + NABH Ready
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            {totalMissing > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 text-red-200 text-xs rounded-lg px-3 py-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {totalMissing} missing doc{totalMissing > 1 ? "s" : ""} across
                records
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
          currentStep="rcm-workflow"
          onNavigate={(page) => onNavigate?.(page)}
        />
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white border border-hp-border rounded-xl h-10 mb-6 p-1">
            <TabsTrigger
              data-ocid="clinicaldocs.new.tab"
              value="new"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Document Set
            </TabsTrigger>
            <TabsTrigger
              data-ocid="clinicaldocs.tracker.tab"
              value="tracker"
              className="rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Document Tracker
              {records.length > 0 && (
                <span className="ml-1.5 bg-hp-blue/20 text-hp-blue text-[10px] font-bold px-1.5 py-0.5 rounded-full data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {records.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-0">
            <NewDocumentSetForm
              actor={typedActor}
              onSuccess={handleNewDocSuccess}
            />
          </TabsContent>

          <TabsContent value="tracker" className="mt-0">
            <DocumentTrackerTab
              records={records}
              isLoading={isLoadingRecords}
              actor={typedActor}
              onRefresh={loadRecords}
            />
          </TabsContent>
        </Tabs>
      </div>
    </motion.main>
  );
}
