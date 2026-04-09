import type {
  ClaimRecord,
  backendInterface as FullBackendInterface,
  Patient,
  PaymentRecord,
  PreAuthRecord,
  RegisterRequest,
  TpaMaster as TpaMasterType,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  Fingerprint,
  GitMerge,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Upload,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkflowBanner as WorkflowBannerInline } from "./WorkflowBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// TpaMaster type is imported from @/backend.d as TpaMasterType

interface FormErrors {
  name?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  payerType?: string;
  payerName?: string;
  policyDates?: string;
}

interface FormState {
  name: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  abhaId: string;
  payerType: string;
  payerName: string;
  policyNumber: string;
  policyStart: string;
  policyEnd: string;
  eligibilityStatus: string;
}

interface DocState {
  idProof: File | null;
  policyDoc: File | null;
  referralLetter: File | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  dob: "",
  gender: "",
  phone: "",
  address: "",
  abhaId: "",
  payerType: "",
  payerName: "",
  policyNumber: "",
  policyStart: "",
  policyEnd: "",
  eligibilityStatus: "NotChecked",
};

const EMPTY_DOCS: DocState = {
  idProof: null,
  policyDoc: null,
  referralLetter: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEligibilityConfig(status: string) {
  switch (status) {
    case "Eligible":
      return {
        label: "Eligible",
        className: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case "Pending":
      return {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
    case "Rejected":
      return {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border-red-200",
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: "Not Checked",
        className: "bg-gray-100 text-gray-600 border-gray-200",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      };
  }
}

function EligibilityBadge({ status }: { status: string }) {
  const config = getEligibilityConfig(status);
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5",
        config.className,
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span
      data-ocid="rcm.error_state"
      className="flex items-center gap-1 text-xs text-red-600 mt-1"
    >
      <AlertCircle className="h-3 w-3" />
      {message}
    </span>
  );
}

function DocUploadSlot({
  label,
  accept,
  file,
  onChange,
  ocid,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  ocid: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-hp-muted uppercase tracking-wide">
        {label}
      </Label>
      <button
        type="button"
        className={cn(
          "flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors w-full text-left",
          file
            ? "border-hp-blue/50 bg-blue-50"
            : "border-hp-border bg-hp-bg hover:border-hp-blue/40",
        )}
        onClick={() => ref.current?.click()}
      >
        <FileText
          className={cn(
            "h-4 w-4 shrink-0",
            file ? "text-hp-blue" : "text-hp-muted",
          )}
        />
        <span
          className={cn(
            "text-xs flex-1 truncate",
            file ? "text-hp-body font-medium" : "text-hp-placeholder",
          )}
        >
          {file ? file.name : "Click to upload (image or PDF)"}
        </span>
        <Upload className="h-3.5 w-3.5 text-hp-muted shrink-0" />
        <input
          ref={ref}
          type="file"
          accept={accept}
          data-ocid={ocid}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </button>
      {file && (
        <button
          type="button"
          className="self-start text-[10px] text-red-500 hover:text-red-700 underline"
          onClick={() => {
            onChange(null);
            if (ref.current) ref.current.value = "";
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Patient Form
// ---------------------------------------------------------------------------

function RegisterPatientForm({
  onSuccess,
  actor,
}: {
  onSuccess: () => void;
  actor: FullBackendInterface | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [docs, setDocs] = useState<DocState>(EMPTY_DOCS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [tpaMasters, setTpaMasters] = useState<TpaMasterType[]>([]);
  const [useManualPayer, setUseManualPayer] = useState(false);

  // Fetch TPA masters on mount
  useEffect(() => {
    async function loadTpas() {
      try {
        if (!actor) return;
        const tpas = await actor.getTpas();
        setTpaMasters(tpas.filter((t) => t.isActive));
      } catch {
        // silently fail - fallback to text input
      }
    }
    loadTpas();
  }, [actor]);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const payerLabel =
    form.payerType === "TPA"
      ? "TPA Name"
      : form.payerType === "Govt Scheme"
        ? "Scheme Name"
        : form.payerType === "Corporate"
          ? "Corporate Name"
          : form.payerType === "PSU"
            ? "PSU / Organisation Name"
            : "Payer / Scheme Name";

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.dob) errs.dob = "Date of birth is required";
    if (!form.gender) errs.gender = "Gender is required";
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, "")))
      errs.phone = "Enter a valid 10-digit mobile number";
    if (!form.payerType) errs.payerType = "Payer type is required";
    if (!form.payerName.trim() && form.payerType !== "Self Pay")
      errs.payerName = `${payerLabel} is required`;
    if (
      form.policyStart &&
      form.policyEnd &&
      form.policyEnd <= form.policyStart
    )
      errs.policyDates = "Policy end date must be after start date";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function checkEligibility() {
    setIsCheckingEligibility(true);
    await new Promise((r) => setTimeout(r, 1500));
    const status = Math.random() > 0.3 ? "Eligible" : "Pending";
    set("eligibilityStatus", status);
    setIsCheckingEligibility(false);
    if (status === "Eligible") {
      toast.success("Eligibility verified", {
        description: "Patient is eligible for coverage under selected scheme.",
      });
    } else {
      toast.warning("Eligibility pending", {
        description: "Verification pending — manual review may be required.",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const req: RegisterRequest = {
        abhaId: form.abhaId.trim(),
        name: form.name.trim(),
        dob: form.dob,
        gender: form.gender,
        phone: form.phone.replace(/\s/g, ""),
        address: form.address.trim(),
        payerType: form.payerType,
        payerName: form.payerName.trim(),
        policyNumber: form.policyNumber.trim(),
        policyStart: form.policyStart,
        policyEnd: form.policyEnd,
      };
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.registerPatient(req);
      if ("ok" in result) {
        toast.success("Patient registered successfully!", {
          description: `Patient ID: PAT-${result.ok}`,
        });
        setForm(EMPTY_FORM);
        setDocs(EMPTY_DOCS);
        setErrors({});
        onSuccess();
      } else {
        toast.error("Registration failed", { description: result.err });
      }
    } catch {
      toast.error("Registration failed", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Section 1: Demographics */}
      <SectionCard
        title="Patient Demographics"
        icon={<User className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="pt-name" className="rcm-label">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pt-name"
              data-ocid="rcm.name.input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Enter patient's full name"
              className={cn(errors.name && "border-red-400")}
            />
            <FieldError message={errors.name} />
          </div>

          <div>
            <Label htmlFor="pt-dob" className="rcm-label">
              Date of Birth <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pt-dob"
              data-ocid="rcm.dob.input"
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
              className={cn(errors.dob && "border-red-400")}
            />
            <FieldError message={errors.dob} />
          </div>

          <div>
            <Label className="rcm-label">
              Gender <span className="text-red-500">*</span>
            </Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger
                data-ocid="rcm.gender.select"
                className={cn(errors.gender && "border-red-400")}
              >
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Prefer not to say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.gender} />
          </div>

          <div>
            <Label htmlFor="pt-phone" className="rcm-label">
              Contact Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pt-phone"
              data-ocid="rcm.phone.input"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              className={cn(errors.phone && "border-red-400")}
            />
            <FieldError message={errors.phone} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pt-address" className="rcm-label">
              Address
            </Label>
            <Textarea
              id="pt-address"
              data-ocid="rcm.address.textarea"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Enter full residential address"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 2: ABHA ID */}
      <SectionCard
        title="ABHA ID (ABDM)"
        icon={<Fingerprint className="h-4 w-4" />}
        badge={
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs border px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            ABDM Integrated
          </Badge>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="pt-abha" className="rcm-label">
              ABHA ID
            </Label>
            <Input
              id="pt-abha"
              data-ocid="rcm.abha.input"
              value={form.abhaId}
              onChange={(e) => set("abhaId", e.target.value)}
              placeholder="12-3456-7890-1234 (14-digit ABHA number)"
              maxLength={17}
            />
          </div>
          <p className="text-xs text-hp-muted leading-relaxed flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
            ABHA ID enables seamless health record access under Ayushman Bharat
            Digital Mission (ABDM). The patient's health records will be linked
            to their ABHA address for continuity of care.
          </p>
        </div>
      </SectionCard>

      {/* Section 3: Insurance Details */}
      <SectionCard
        title="Insurance Details"
        icon={<Shield className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="rcm-label">
              Payer Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.payerType}
              onValueChange={(v) => {
                set("payerType", v);
                set("payerName", "");
              }}
            >
              <SelectTrigger
                data-ocid="rcm.payer_type.select"
                className={cn(errors.payerType && "border-red-400")}
              >
                <SelectValue placeholder="Select payer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TPA">TPA</SelectItem>
                <SelectItem value="Govt Scheme">Govt Scheme</SelectItem>
                <SelectItem value="Corporate">Corporate</SelectItem>
                <SelectItem value="PSU">PSU</SelectItem>
                <SelectItem value="Self Pay">Self Pay</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.payerType} />
          </div>

          <div>
            <Label htmlFor="pt-payer-name" className="rcm-label">
              {payerLabel} <span className="text-red-500">*</span>
            </Label>
            {tpaMasters.length > 0 && !useManualPayer ? (
              <div className="space-y-1.5">
                <Select
                  value={form.payerName}
                  onValueChange={(v) => {
                    if (v === "__manual__") {
                      setUseManualPayer(true);
                      set("payerName", "");
                    } else {
                      set("payerName", v);
                    }
                  }}
                >
                  <SelectTrigger
                    data-ocid="rcm.payer_name.select"
                    className={cn(errors.payerName && "border-red-400")}
                  >
                    <SelectValue
                      placeholder={`Select ${payerLabel.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tpaMasters
                      .filter(
                        (t) =>
                          !form.payerType ||
                          t.tpaType === form.payerType ||
                          form.payerType === "",
                      )
                      .map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.name}
                          className="text-sm"
                        >
                          {t.name}{" "}
                          <span className="text-hp-muted text-xs ml-1">
                            ({t.code})
                          </span>
                        </SelectItem>
                      ))}
                    <SelectItem
                      value="__manual__"
                      className="text-sm text-hp-muted italic"
                    >
                      Other (type manually)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  id="pt-payer-name"
                  data-ocid="rcm.payer_name.input"
                  value={form.payerName}
                  onChange={(e) => set("payerName", e.target.value)}
                  placeholder={`Enter ${payerLabel.toLowerCase()}`}
                  className={cn(errors.payerName && "border-red-400")}
                />
                {tpaMasters.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-hp-blue underline"
                    onClick={() => setUseManualPayer(false)}
                  >
                    ← Back to dropdown
                  </button>
                )}
              </div>
            )}
            <FieldError message={errors.payerName} />
          </div>

          <div>
            <Label htmlFor="pt-policy-num" className="rcm-label">
              Policy Number
            </Label>
            <Input
              id="pt-policy-num"
              data-ocid="rcm.policy_number.input"
              value={form.policyNumber}
              onChange={(e) => set("policyNumber", e.target.value)}
              placeholder="Policy / Member ID"
            />
          </div>

          <div />

          <div>
            <Label htmlFor="pt-policy-start" className="rcm-label">
              Policy Valid From
            </Label>
            <Input
              id="pt-policy-start"
              data-ocid="rcm.policy_start.input"
              type="date"
              value={form.policyStart}
              onChange={(e) => set("policyStart", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="pt-policy-end" className="rcm-label">
              Policy Valid To
            </Label>
            <Input
              id="pt-policy-end"
              data-ocid="rcm.policy_end.input"
              type="date"
              value={form.policyEnd}
              onChange={(e) => set("policyEnd", e.target.value)}
              className={cn(errors.policyDates && "border-red-400")}
            />
            <FieldError message={errors.policyDates} />
          </div>
        </div>
      </SectionCard>

      {/* Section 4: Eligibility Verification */}
      <SectionCard
        title="Eligibility Verification"
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <Label className="rcm-label">Eligibility Status</Label>
            <Select
              value={form.eligibilityStatus}
              onValueChange={(v) => set("eligibilityStatus", v)}
            >
              <SelectTrigger data-ocid="rcm.eligibility.select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NotChecked">Not Checked</SelectItem>
                <SelectItem value="Eligible">Eligible</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            data-ocid="rcm.check_eligibility.button"
            variant="outline"
            className="border-hp-blue/60 text-hp-blue hover:bg-hp-blue hover:text-white"
            onClick={checkEligibility}
            disabled={isCheckingEligibility}
          >
            {isCheckingEligibility ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isCheckingEligibility ? "Checking..." : "Check Eligibility"}
          </Button>

          <AnimatePresence mode="wait">
            {form.eligibilityStatus !== "NotChecked" && (
              <motion.div
                key={form.eligibilityStatus}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <EligibilityBadge status={form.eligibilityStatus} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      {/* Section 5: Document Upload */}
      <SectionCard
        title="Document Upload"
        icon={<Upload className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DocUploadSlot
            label="ID Proof (Aadhaar / PAN / Voter ID)"
            accept="image/*,.pdf"
            file={docs.idProof}
            onChange={(f) => setDocs((d) => ({ ...d, idProof: f }))}
            ocid="rcm.id_proof.upload_button"
          />
          <DocUploadSlot
            label="Insurance Policy Document"
            accept="image/*,.pdf"
            file={docs.policyDoc}
            onChange={(f) => setDocs((d) => ({ ...d, policyDoc: f }))}
            ocid="rcm.policy_doc.upload_button"
          />
          <DocUploadSlot
            label="Referral Letter"
            accept="image/*,.pdf"
            file={docs.referralLetter}
            onChange={(f) => setDocs((d) => ({ ...d, referralLetter: f }))}
            ocid="rcm.referral.upload_button"
          />
        </div>
        <p className="text-xs text-hp-muted mt-3">
          Accepted formats: JPEG, PNG, PDF. Max 5 MB per document.
        </p>
      </SectionCard>

      {/* Submit */}
      <Button
        type="submit"
        data-ocid="rcm.register.submit_button"
        className="w-full bg-hp-blue text-white font-bold hover:bg-hp-navy rounded-xl h-11 text-sm"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Registering Patient...
          </>
        ) : (
          <>
            <User className="h-4 w-4 mr-2" />
            Register Patient
          </>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Patient List
// ---------------------------------------------------------------------------

const ELIGIBILITY_FILTERS = [
  "All",
  "Eligible",
  "Pending",
  "Rejected",
  "NotChecked",
] as const;

type EligibilityFilter = (typeof ELIGIBILITY_FILTERS)[number];

function PatientCard({
  patient,
  index,
  onUpdateStatus,
}: {
  patient: Patient;
  index: number;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true);
    try {
      await onUpdateStatus(patient.id, newStatus);
      toast.success("Eligibility updated", {
        description: `Status changed to ${newStatus} for ${patient.name}.`,
      });
    } catch {
      toast.error("Failed to update eligibility");
    } finally {
      setIsUpdating(false);
    }
  }

  const idxLabel = index + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      data-ocid={`rcm.patient.item.${idxLabel}`}
      className="bg-white rounded-xl border border-hp-border shadow-xs p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-hp-blue/10 text-hp-blue border-hp-blue/20 text-xs border px-2 py-0.5 rounded-full font-bold">
            PAT-{patient.id}
          </Badge>
          {patient.abhaId && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs border px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3" />
              ABDM
            </Badge>
          )}
        </div>
        <EligibilityBadge status={patient.eligibilityStatus} />
      </div>

      <div className="mb-2">
        <p className="font-semibold text-hp-body text-sm">{patient.name}</p>
        <p className="text-xs text-hp-muted">
          {patient.dob} · {patient.gender}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {patient.abhaId && (
          <div className="col-span-2">
            <span className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
              ABHA ID
            </span>
            <p className="text-xs text-hp-body font-mono">{patient.abhaId}</p>
          </div>
        )}
        <div>
          <span className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
            Payer
          </span>
          <p className="text-xs text-hp-body line-clamp-1">
            {patient.payerType || "—"}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
            Scheme / TPA
          </span>
          <p className="text-xs text-hp-body line-clamp-1">
            {patient.payerName || "—"}
          </p>
        </div>
        {patient.policyNumber && (
          <div className="col-span-2">
            <span className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
              Policy No.
            </span>
            <p className="text-xs text-hp-body">{patient.policyNumber}</p>
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            data-ocid={`rcm.patient.edit_button.${idxLabel}`}
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 border-hp-border text-hp-muted hover:border-hp-blue hover:text-hp-blue"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3 mr-1" />
            )}
            Update Eligibility
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {["Eligible", "Pending", "Rejected", "NotChecked"].map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => handleStatusChange(s)}
              className={cn(s === patient.eligibilityStatus && "font-semibold")}
            >
              <EligibilityBadge status={s} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}

function PatientList({ actor }: { actor: FullBackendInterface | null }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EligibilityFilter>("All");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!actor) throw new Error("Actor not ready");
      const data = await actor.getPatients();
      setPatients(data);
    } catch {
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdateStatus(id: string, status: string) {
    if (!actor) throw new Error("Actor not ready");
    await actor.updateEligibility(id, status);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, eligibilityStatus: status } : p)),
    );
  }

  const q = search.toLowerCase();
  const filtered = patients.filter((p) => {
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.abhaId.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "All" || p.eligibilityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hp-muted" />
          <Input
            data-ocid="rcm.patient_search.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ABHA ID..."
            className="pl-9 h-9"
          />
        </div>
        <Button
          type="button"
          data-ocid="rcm.patient_list.secondary_button"
          variant="outline"
          size="sm"
          onClick={load}
          className="h-9 border-hp-border text-hp-muted hover:border-hp-blue hover:text-hp-blue"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Status filter pills */}
      <div data-ocid="rcm.status_filter.tab" className="flex flex-wrap gap-2">
        {ELIGIBILITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === f
                ? "bg-hp-blue text-white border-hp-blue"
                : "bg-white text-hp-muted border-hp-border hover:border-hp-blue/50 hover:text-hp-blue",
            )}
          >
            {f === "NotChecked" ? "Not Checked" : f}
            {f !== "All" && (
              <span className="ml-1 opacity-70">
                ({patients.filter((p) => p.eligibilityStatus === f).length})
              </span>
            )}
            {f === "All" && (
              <span className="ml-1 opacity-70">({patients.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div
          data-ocid="rcm.patient_list.loading_state"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-hp-border p-4 space-y-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-ocid="rcm.patient_list.empty_state"
          className="text-center py-16 bg-white rounded-xl border border-hp-border"
        >
          <Users className="h-10 w-10 text-hp-muted mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-hp-body mb-1">
            {search || statusFilter !== "All"
              ? "No patients match your search"
              : "No patients registered yet"}
          </p>
          <p className="text-sm text-hp-muted">
            {search || statusFilter !== "All"
              ? "Try clearing filters or adjusting the search term."
              : "Register your first patient using the Register Patient tab above."}
          </p>
        </motion.div>
      )}

      {/* Patient grid */}
      {!loading && filtered.length > 0 && (
        <AnimatePresence initial={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <PatientCard
                key={p.id}
                patient={p}
                index={i}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RCM Module Root
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Patient Timeline
// ---------------------------------------------------------------------------

function TimelineEntry({
  type,
  id,
  status,
  date,
  details,
  onNavigate,
}: {
  type: "preauth" | "claim" | "payment";
  id: string;
  status: string;
  date: string;
  details: string;
  onNavigate: (page: string) => void;
}) {
  const config = {
    preauth: {
      label: "Pre-Auth",
      icon: FileCheck,
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
      nav: "rcm-workflow",
    },
    claim: {
      label: "Claim",
      icon: Receipt,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-200",
      nav: "rcm-workflow",
    },
    payment: {
      label: "Payment",
      icon: Banknote,
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-200",
      nav: "payment",
    },
  }[type];
  const Icon = config.icon;

  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center border",
            config.bg,
          )}
        >
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="w-px flex-1 bg-hp-border mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={cn("text-xs font-bold", config.color)}>
            {config.label}
          </span>
          <span className="text-xs font-mono text-hp-muted">{id}</span>
          <Badge className="text-[10px] bg-gray-100 text-gray-600 border-gray-200 border rounded-full px-1.5 py-0.5">
            {status}
          </Badge>
        </div>
        <p className="text-xs text-hp-muted">{date}</p>
        {details && <p className="text-xs text-hp-body mt-0.5">{details}</p>}
        <button
          type="button"
          onClick={() => onNavigate(config.nav)}
          className={cn(
            "text-[11px] font-semibold underline mt-1.5",
            config.color,
          )}
        >
          View {config.label} →
        </button>
      </div>
    </div>
  );
}

function PatientTimeline({
  actor,
  onNavigate,
}: {
  actor: FullBackendInterface | null;
  onNavigate: (page: string) => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [preAuths, setPreAuths] = useState<PreAuthRecord[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    async function loadPatients() {
      if (!actor) return;
      try {
        const data = await actor.getPatients();
        setPatients(data);
      } catch {
        // noop
      } finally {
        setPatientsLoading(false);
      }
    }
    loadPatients();
  }, [actor]);

  async function loadTimeline(patientId: string) {
    if (!actor || !patientId) return;
    setLoading(true);
    try {
      const [pas, cls, pays] = await Promise.all([
        actor.getPreAuthsByPatient(patientId),
        actor.getClaimsByPatient(patientId),
        actor.getPaymentsByPatient(patientId),
      ]);
      setPreAuths(pas);
      setClaims(cls);
      setPayments(pays);
    } catch {
      toast.error("Failed to load patient timeline");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPatient(id: string) {
    setSelectedPatientId(id);
    setPreAuths([]);
    setClaims([]);
    setPayments([]);
    if (id) loadTimeline(id);
  }

  function formatNsDate(ns: bigint): string {
    return new Date(Number(ns / 1_000_000n)).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Merge all entries and sort newest first
  type Entry = {
    type: "preauth" | "claim" | "payment";
    id: string;
    status: string;
    date: string;
    details: string;
    sortKey: bigint;
  };
  const entries: Entry[] = [
    ...preAuths.map((r) => ({
      type: "preauth" as const,
      id: r.id,
      status: r.status,
      date: formatNsDate(r.submittedAt),
      details: `${r.packageCode} — ${r.packageName} · ₹${r.requestedAmount}`,
      sortKey: r.submittedAt,
    })),
    ...claims.map((r) => ({
      type: "claim" as const,
      id: r.id,
      status: r.status,
      date: formatNsDate(r.createdAt),
      details: `${r.packageCode} · ₹${r.billedAmount} billed`,
      sortKey: r.createdAt,
    })),
    ...payments.map((r) => ({
      type: "payment" as const,
      id: r.id,
      status: r.settlementStatus,
      date: formatNsDate(r.createdAt),
      details: `Claim ${r.claimId} · ₹${r.paidAmount} paid`,
      sortKey: r.createdAt,
    })),
  ].sort((a, b) => Number(b.sortKey - a.sortKey));

  return (
    <div className="space-y-5">
      <SectionCard title="Select Patient" icon={<User className="h-4 w-4" />}>
        {patientsLoading ? (
          <div className="flex items-center gap-2 text-hp-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading patients…
          </div>
        ) : (
          <Select value={selectedPatientId} onValueChange={handleSelectPatient}>
            <SelectTrigger
              data-ocid="rcm.timeline.patient.select"
              className="text-sm"
            >
              <SelectValue placeholder="Select a patient to view their timeline" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-sm">
                  {p.name}{" "}
                  <span className="text-hp-muted text-xs">({p.id})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SectionCard>

      {selectedPatientId && (
        <SectionCard
          title="Activity Timeline"
          icon={<GitMerge className="h-4 w-4" />}
          badge={
            entries.length > 0 ? (
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs rounded-full px-2">
                {entries.length} records
              </Badge>
            ) : undefined
          }
        >
          {loading ? (
            <div
              data-ocid="rcm.timeline.loading_state"
              className="flex items-center gap-2 text-hp-muted text-sm py-4"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading timeline…
            </div>
          ) : entries.length === 0 ? (
            <div
              data-ocid="rcm.timeline.empty_state"
              className="text-center py-8 text-hp-muted"
            >
              <GitMerge className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No activity found</p>
              <p className="text-xs mt-0.5">
                No pre-auths, claims, or payments for this patient.
              </p>
            </div>
          ) : (
            <div className="pt-1">
              {entries.map((entry) => (
                <TimelineEntry
                  key={`${entry.type}-${entry.id}`}
                  type={entry.type}
                  id={entry.id}
                  status={entry.status}
                  date={entry.date}
                  details={entry.details}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RCM Module Root
// ---------------------------------------------------------------------------

export function RCMModule({
  onNavigate,
}: { onNavigate?: (page: string) => void }) {
  const { actor } = useActor();
  const fullActor = actor as FullBackendInterface | null;
  const [activeTab, setActiveTab] = useState("register");
  const patientListRef = useRef<{ reload: () => void }>(null);

  function handleNavigate(page: string) {
    onNavigate?.(page);
  }

  function handleRegistrationSuccess() {
    setActiveTab("list");
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex-1 py-6 px-4"
    >
      <div className="max-w-screen-xl mx-auto">
        {/* Module Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-hp-body">
              AI Claim Zon – Patient Access &amp; Registration
            </h1>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                ABDM Ready
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs px-2.5 py-0.5 rounded-full">
                NABH Ready
              </Badge>
            </div>
          </div>
          <p className="text-hp-muted text-sm">
            RCM Module · Patient Access &amp; Registration · Clean data = clean
            claims
          </p>
        </div>

        {/* Workflow Banner */}
        <WorkflowBannerInline currentStep="rcm" onNavigate={handleNavigate} />

        {/* Info Banner */}
        <div className="mb-6 bg-gradient-to-r from-hp-blue/5 to-blue-50 border border-hp-blue/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-hp-blue shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-hp-body">
              ABDM + NABH Ready RCM Intake
            </p>
            <p className="text-xs text-hp-muted mt-0.5">
              All patient registrations are validated for mandatory fields,
              checked for duplicates, and eligibility can be verified in
              real-time against TPA, Government Scheme, and Corporate payers.
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-white border border-hp-border rounded-xl p-1 h-auto w-full sm:w-auto">
            <TabsTrigger
              data-ocid="rcm.register.tab"
              value="register"
              className="flex-1 sm:flex-none rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white data-[state=active]:shadow-sm px-5 py-2"
            >
              <User className="h-4 w-4 mr-2" />
              Register Patient
            </TabsTrigger>
            <TabsTrigger
              data-ocid="rcm.patient_list.tab"
              value="list"
              className="flex-1 sm:flex-none rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white data-[state=active]:shadow-sm px-5 py-2"
            >
              <Users className="h-4 w-4 mr-2" />
              Patient List
            </TabsTrigger>
            <TabsTrigger
              data-ocid="rcm.timeline.tab"
              value="timeline"
              className="flex-1 sm:flex-none rounded-lg text-sm data-[state=active]:bg-hp-blue data-[state=active]:text-white data-[state=active]:shadow-sm px-5 py-2"
            >
              <GitMerge className="h-4 w-4 mr-2" />
              Patient Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-0">
            <RegisterPatientForm
              onSuccess={handleRegistrationSuccess}
              actor={fullActor}
            />
          </TabsContent>

          <TabsContent
            value="list"
            ref={patientListRef as never}
            className="mt-0"
          >
            <PatientList actor={fullActor} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-0">
            <PatientTimeline actor={fullActor} onNavigate={handleNavigate} />
          </TabsContent>
        </Tabs>
      </div>
    </motion.main>
  );
}
