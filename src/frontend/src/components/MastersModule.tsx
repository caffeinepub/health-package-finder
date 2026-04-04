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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  Building2,
  Database,
  Edit2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  Warehouse,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Local Types
// ---------------------------------------------------------------------------

type HospitalMaster = {
  id: string;
  name: string;
  code: string;
  address: string;
  nabhNumber: string;
  rohiniId: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

type DoctorMaster = {
  id: string;
  name: string;
  registrationNumber: string;
  specialisation: string;
  department: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

type TpaMaster = {
  id: string;
  name: string;
  code: string;
  tpaType: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

type IcdMaster = {
  id: string;
  code: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

type WardMaster = {
  id: string;
  name: string;
  wardType: string;
  ratePerDay: string;
  totalBeds: bigint;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared Sub-components
// ---------------------------------------------------------------------------

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      className={cn(
        "text-xs border rounded-full px-2 py-0.5 font-semibold",
        isActive
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-500 border-gray-200",
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

function MasterSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 rounded-xl border border-gray-100"
        >
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
      data-ocid="masters.empty_state"
    >
      <Database className="h-10 w-10 text-hp-blue/30 mb-3" />
      <p className="text-hp-body font-medium text-sm">No {label} records yet</p>
      <p className="text-hp-muted text-xs mt-1">
        Click "Add" to create your first entry
      </p>
    </motion.div>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-hp-body">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// Delete confirmation dialog
function DeleteConfirmDialog({
  open,
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm" data-ocid="masters.delete.dialog">
        <DialogHeader>
          <DialogTitle className="text-base text-red-600 flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Confirm Delete
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-hp-body">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{name}</span>? This action cannot be
          undone.
        </p>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-ocid="masters.delete.cancel_button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            data-ocid="masters.delete.confirm_button"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// HOSPITAL MASTER
// ---------------------------------------------------------------------------

type HospitalForm = {
  name: string;
  code: string;
  address: string;
  nabhNumber: string;
  rohiniId: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const emptyHospitalForm: HospitalForm = {
  name: "",
  code: "",
  address: "",
  nabhNumber: "",
  rohiniId: "",
  contactPerson: "",
  phone: "",
  email: "",
  isActive: true,
};

function HospitalTab({ actor }: { actor: any }) {
  const [records, setRecords] = useState<HospitalMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HospitalMaster | null>(null);
  const [form, setForm] = useState<HospitalForm>(emptyHospitalForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HospitalMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (actor as any).getHospitals();
      setRecords(data);
    } catch {
      toast.error("Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyHospitalForm);
    setDialogOpen(true);
  };

  const openEdit = (rec: HospitalMaster) => {
    setEditing(rec);
    setForm({
      name: rec.name,
      code: rec.code,
      address: rec.address,
      nabhNumber: rec.nabhNumber,
      rohiniId: rec.rohiniId,
      contactPerson: rec.contactPerson,
      phone: rec.phone,
      email: rec.email,
      isActive: rec.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and Code are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const ok = await (actor as any).updateHospital(editing.id, form);
        if (ok) {
          toast.success("Hospital updated");
          setDialogOpen(false);
          load();
        } else {
          toast.error("Update failed");
        }
      } else {
        const res = await (actor as any).createHospital(form);
        if ("ok" in res) {
          toast.success("Hospital created");
          setDialogOpen(false);
          load();
        } else {
          toast.error(res.err ?? "Create failed");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (actor as any).deleteHospital(deleteTarget.id);
      toast.success("Hospital deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search hospitals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-ocid="hospital.search_input"
          />
        </div>
        <Button
          size="sm"
          className="bg-hp-blue hover:bg-hp-navy text-white font-semibold gap-1.5"
          onClick={openAdd}
          data-ocid="hospital.add_button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Hospital
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <MasterSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label="hospital" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-hp-blue/30 hover:shadow-sm transition-all"
                data-ocid={`hospital.item.${idx + 1}`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-hp-blue/10 text-hp-blue shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-hp-heading text-sm truncate">
                    {rec.name}
                  </p>
                  <p className="text-xs text-hp-muted">
                    Code: {rec.code}
                    {rec.nabhNumber ? ` · NABH: ${rec.nabhNumber}` : ""}
                    {rec.phone ? ` · ${rec.phone}` : ""}
                  </p>
                </div>
                <ActiveBadge isActive={rec.isActive} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-hp-blue"
                  onClick={() => openEdit(rec)}
                  data-ocid={`hospital.edit_button.${idx + 1}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-red-600"
                  onClick={() => setDeleteTarget(rec)}
                  data-ocid={`hospital.delete_button.${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !saving && setDialogOpen(v)}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="hospital.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-hp-heading flex items-center gap-2">
              <Building2 className="h-4 w-4 text-hp-blue" />
              {editing ? "Edit Hospital" : "Add Hospital"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Hospital Name" required>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="AIIMS Delhi"
                  className="h-9 text-sm"
                  data-ocid="hospital.name.input"
                />
              </FieldRow>
              <FieldRow label="Hospital Code" required>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value }))
                  }
                  placeholder="AIIMS001"
                  className="h-9 text-sm"
                  data-ocid="hospital.code.input"
                />
              </FieldRow>
            </div>
            <FieldRow label="Address">
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Ansari Nagar, New Delhi"
                className="h-9 text-sm"
                data-ocid="hospital.address.input"
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="NABH Accreditation No">
                <Input
                  value={form.nabhNumber}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nabhNumber: e.target.value }))
                  }
                  placeholder="NABH-2024-XXXXX"
                  className="h-9 text-sm"
                  data-ocid="hospital.nabh.input"
                />
              </FieldRow>
              <FieldRow label="ROHINI ID">
                <Input
                  value={form.rohiniId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, rohiniId: e.target.value }))
                  }
                  placeholder="ROH123456"
                  className="h-9 text-sm"
                  data-ocid="hospital.rohini.input"
                />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Contact Person">
                <Input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contactPerson: e.target.value }))
                  }
                  placeholder="Dr. Ramesh Kumar"
                  className="h-9 text-sm"
                  data-ocid="hospital.contact.input"
                />
              </FieldRow>
              <FieldRow label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  className="h-9 text-sm"
                  data-ocid="hospital.phone.input"
                />
              </FieldRow>
            </div>
            <FieldRow label="Email">
              <Input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="admin@hospital.org"
                type="email"
                className="h-9 text-sm"
                data-ocid="hospital.email.input"
              />
            </FieldRow>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-ocid="hospital.active.switch"
              />
              <Label className="text-sm text-hp-body">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-ocid="hospital.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-hp-blue hover:bg-hp-navy text-white"
              onClick={handleSave}
              disabled={saving}
              data-ocid="hospital.save_button"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOCTOR MASTER
// ---------------------------------------------------------------------------

type DoctorForm = {
  name: string;
  registrationNumber: string;
  specialisation: string;
  department: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const emptyDoctorForm: DoctorForm = {
  name: "",
  registrationNumber: "",
  specialisation: "",
  department: "",
  phone: "",
  email: "",
  isActive: true,
};

function DoctorTab({ actor }: { actor: any }) {
  const [records, setRecords] = useState<DoctorMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorMaster | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyDoctorForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DoctorMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (actor as any).getDoctors();
      setRecords(data);
    } catch {
      toast.error("Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyDoctorForm);
    setDialogOpen(true);
  };

  const openEdit = (rec: DoctorMaster) => {
    setEditing(rec);
    setForm({
      name: rec.name,
      registrationNumber: rec.registrationNumber,
      specialisation: rec.specialisation,
      department: rec.department,
      phone: rec.phone,
      email: rec.email,
      isActive: rec.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.registrationNumber.trim()) {
      toast.error("Name and Registration Number are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const ok = await (actor as any).updateDoctor(editing.id, form);
        if (ok) {
          toast.success("Doctor updated");
          setDialogOpen(false);
          load();
        } else {
          toast.error("Update failed");
        }
      } else {
        const res = await (actor as any).createDoctor(form);
        if ("ok" in res) {
          toast.success("Doctor created");
          setDialogOpen(false);
          load();
        } else {
          toast.error(res.err ?? "Create failed");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (actor as any).deleteDoctor(deleteTarget.id);
      toast.success("Doctor deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.specialisation.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-ocid="doctor.search_input"
          />
        </div>
        <Button
          size="sm"
          className="bg-hp-blue hover:bg-hp-navy text-white font-semibold gap-1.5"
          onClick={openAdd}
          data-ocid="doctor.add_button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Doctor
        </Button>
      </div>

      {loading ? (
        <MasterSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label="doctor" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-hp-blue/30 hover:shadow-sm transition-all"
                data-ocid={`doctor.item.${idx + 1}`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-hp-heading text-sm truncate">
                    Dr. {rec.name}
                  </p>
                  <p className="text-xs text-hp-muted">
                    {rec.registrationNumber}
                    {rec.specialisation ? ` · ${rec.specialisation}` : ""}
                    {rec.department ? ` · ${rec.department}` : ""}
                  </p>
                </div>
                <ActiveBadge isActive={rec.isActive} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-hp-blue"
                  onClick={() => openEdit(rec)}
                  data-ocid={`doctor.edit_button.${idx + 1}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-red-600"
                  onClick={() => setDeleteTarget(rec)}
                  data-ocid={`doctor.delete_button.${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !saving && setDialogOpen(v)}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="doctor.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-hp-heading flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-indigo-600" />
              {editing ? "Edit Doctor" : "Add Doctor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Doctor Name" required>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Ramesh Kumar"
                  className="h-9 text-sm"
                  data-ocid="doctor.name.input"
                />
              </FieldRow>
              <FieldRow label="MCI Registration No" required>
                <Input
                  value={form.registrationNumber}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      registrationNumber: e.target.value,
                    }))
                  }
                  placeholder="MCI-12345"
                  className="h-9 text-sm"
                  data-ocid="doctor.registration.input"
                />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Specialisation">
                <Input
                  value={form.specialisation}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specialisation: e.target.value }))
                  }
                  placeholder="Cardiology"
                  className="h-9 text-sm"
                  data-ocid="doctor.specialisation.input"
                />
              </FieldRow>
              <FieldRow label="Department">
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, department: e.target.value }))
                  }
                  placeholder="Cardiac Sciences"
                  className="h-9 text-sm"
                  data-ocid="doctor.department.input"
                />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  className="h-9 text-sm"
                  data-ocid="doctor.phone.input"
                />
              </FieldRow>
              <FieldRow label="Email">
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  placeholder="doctor@hospital.org"
                  className="h-9 text-sm"
                  data-ocid="doctor.email.input"
                />
              </FieldRow>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-ocid="doctor.active.switch"
              />
              <Label className="text-sm text-hp-body">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-ocid="doctor.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-hp-blue hover:bg-hp-navy text-white"
              onClick={handleSave}
              disabled={saving}
              data-ocid="doctor.save_button"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget ? `Dr. ${deleteTarget.name}` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TPA / INSURANCE MASTER
// ---------------------------------------------------------------------------

type TpaForm = {
  name: string;
  code: string;
  tpaType: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const emptyTpaForm: TpaForm = {
  name: "",
  code: "",
  tpaType: "TPA",
  contactPerson: "",
  phone: "",
  email: "",
  isActive: true,
};

const TPA_TYPES = ["TPA", "Govt Scheme", "Corporate", "PSU"];

function TpaTab({ actor }: { actor: any }) {
  const [records, setRecords] = useState<TpaMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TpaMaster | null>(null);
  const [form, setForm] = useState<TpaForm>(emptyTpaForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TpaMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (actor as any).getTpas();
      setRecords(data);
    } catch {
      toast.error("Failed to load TPA/Insurance");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyTpaForm);
    setDialogOpen(true);
  };

  const openEdit = (rec: TpaMaster) => {
    setEditing(rec);
    setForm({
      name: rec.name,
      code: rec.code,
      tpaType: rec.tpaType,
      contactPerson: rec.contactPerson,
      phone: rec.phone,
      email: rec.email,
      isActive: rec.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and Code are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const ok = await (actor as any).updateTpa(editing.id, form);
        if (ok) {
          toast.success("TPA/Insurance updated");
          setDialogOpen(false);
          load();
        } else {
          toast.error("Update failed");
        }
      } else {
        const res = await (actor as any).createTpa(form);
        if ("ok" in res) {
          toast.success("TPA/Insurance created");
          setDialogOpen(false);
          load();
        } else {
          toast.error(res.err ?? "Create failed");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (actor as any).deleteTpa(deleteTarget.id);
      toast.success("TPA/Insurance deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.tpaType.toLowerCase().includes(search.toLowerCase()),
  );

  const tpaTypeColor: Record<string, string> = {
    TPA: "bg-blue-100 text-blue-700 border-blue-200",
    "Govt Scheme": "bg-green-100 text-green-700 border-green-200",
    Corporate: "bg-purple-100 text-purple-700 border-purple-200",
    PSU: "bg-amber-100 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search TPA / Insurance..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-ocid="tpa.search_input"
          />
        </div>
        <Button
          size="sm"
          className="bg-hp-blue hover:bg-hp-navy text-white font-semibold gap-1.5"
          onClick={openAdd}
          data-ocid="tpa.add_button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add TPA
        </Button>
      </div>

      {loading ? (
        <MasterSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label="TPA / Insurance" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-hp-blue/30 hover:shadow-sm transition-all"
                data-ocid={`tpa.item.${idx + 1}`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-hp-heading text-sm truncate">
                    {rec.name}
                  </p>
                  <p className="text-xs text-hp-muted">
                    Code: {rec.code}
                    {rec.contactPerson ? ` · ${rec.contactPerson}` : ""}
                    {rec.phone ? ` · ${rec.phone}` : ""}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "text-xs border rounded-full px-2 py-0.5 font-semibold",
                    tpaTypeColor[rec.tpaType] ??
                      "bg-gray-100 text-gray-600 border-gray-200",
                  )}
                >
                  {rec.tpaType}
                </Badge>
                <ActiveBadge isActive={rec.isActive} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-hp-blue"
                  onClick={() => openEdit(rec)}
                  data-ocid={`tpa.edit_button.${idx + 1}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-red-600"
                  onClick={() => setDeleteTarget(rec)}
                  data-ocid={`tpa.delete_button.${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !saving && setDialogOpen(v)}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="tpa.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-hp-heading flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {editing ? "Edit TPA / Insurance" : "Add TPA / Insurance"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Star Health Insurance"
                  className="h-9 text-sm"
                  data-ocid="tpa.name.input"
                />
              </FieldRow>
              <FieldRow label="Code" required>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value }))
                  }
                  placeholder="STAR001"
                  className="h-9 text-sm"
                  data-ocid="tpa.code.input"
                />
              </FieldRow>
            </div>
            <FieldRow label="Type">
              <Select
                value={form.tpaType}
                onValueChange={(v) => setForm((p) => ({ ...p, tpaType: v }))}
              >
                <SelectTrigger
                  className="h-9 text-sm"
                  data-ocid="tpa.type.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TPA_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Contact Person">
                <Input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contactPerson: e.target.value }))
                  }
                  placeholder="Suresh Mehta"
                  className="h-9 text-sm"
                  data-ocid="tpa.contact.input"
                />
              </FieldRow>
              <FieldRow label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  className="h-9 text-sm"
                  data-ocid="tpa.phone.input"
                />
              </FieldRow>
            </div>
            <FieldRow label="Email">
              <Input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                type="email"
                placeholder="claims@insurance.com"
                className="h-9 text-sm"
                data-ocid="tpa.email.input"
              />
            </FieldRow>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-ocid="tpa.active.switch"
              />
              <Label className="text-sm text-hp-body">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-ocid="tpa.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-hp-blue hover:bg-hp-navy text-white"
              onClick={handleSave}
              disabled={saving}
              data-ocid="tpa.save_button"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ICD-10 MASTER
// ---------------------------------------------------------------------------

type IcdForm = {
  code: string;
  description: string;
  category: string;
  isActive: boolean;
};

const emptyIcdForm: IcdForm = {
  code: "",
  description: "",
  category: "",
  isActive: true,
};

function IcdTab({ actor }: { actor: any }) {
  const [records, setRecords] = useState<IcdMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IcdMaster | null>(null);
  const [form, setForm] = useState<IcdForm>(emptyIcdForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IcdMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (actor as any).getIcds();
      setRecords(data);
    } catch {
      toast.error("Failed to load ICD-10 codes");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyIcdForm);
    setDialogOpen(true);
  };

  const openEdit = (rec: IcdMaster) => {
    setEditing(rec);
    setForm({
      code: rec.code,
      description: rec.description,
      category: rec.category,
      isActive: rec.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      toast.error("Code and Description are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const ok = await (actor as any).updateIcd(editing.id, form);
        if (ok) {
          toast.success("ICD-10 updated");
          setDialogOpen(false);
          load();
        } else {
          toast.error("Update failed");
        }
      } else {
        const res = await (actor as any).createIcd(form);
        if ("ok" in res) {
          toast.success("ICD-10 code created");
          setDialogOpen(false);
          load();
        } else {
          toast.error(res.err ?? "Create failed");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (actor as any).deleteIcd(deleteTarget.id);
      toast.success("ICD-10 code deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search ICD-10 codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-ocid="icd.search_input"
          />
        </div>
        <Button
          size="sm"
          className="bg-hp-blue hover:bg-hp-navy text-white font-semibold gap-1.5"
          onClick={openAdd}
          data-ocid="icd.add_button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add ICD-10
        </Button>
      </div>

      {loading ? (
        <MasterSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label="ICD-10" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-hp-blue/30 hover:shadow-sm transition-all"
                data-ocid={`icd.item.${idx + 1}`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                  <span className="text-xs font-black">ICD</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-hp-heading text-sm">
                    <span className="font-mono text-hp-blue">{rec.code}</span> —{" "}
                    {rec.description}
                  </p>
                  {rec.category && (
                    <p className="text-xs text-hp-muted">
                      Category: {rec.category}
                    </p>
                  )}
                </div>
                <ActiveBadge isActive={rec.isActive} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-hp-blue"
                  onClick={() => openEdit(rec)}
                  data-ocid={`icd.edit_button.${idx + 1}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-red-600"
                  onClick={() => setDeleteTarget(rec)}
                  data-ocid={`icd.delete_button.${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !saving && setDialogOpen(v)}
      >
        <DialogContent
          className="max-w-md max-h-[90vh] overflow-y-auto"
          data-ocid="icd.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-hp-heading">
              {editing ? "Edit ICD-10 Code" : "Add ICD-10 Code"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FieldRow label="ICD-10 Code" required>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="I21.0"
                className="h-9 text-sm font-mono"
                data-ocid="icd.code.input"
              />
            </FieldRow>
            <FieldRow label="Description" required>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Acute transmural myocardial infarction"
                className="h-9 text-sm"
                data-ocid="icd.description.input"
              />
            </FieldRow>
            <FieldRow label="Category">
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="Cardiovascular"
                className="h-9 text-sm"
                data-ocid="icd.category.input"
              />
            </FieldRow>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-ocid="icd.active.switch"
              />
              <Label className="text-sm text-hp-body">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-ocid="icd.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-hp-blue hover:bg-hp-navy text-white"
              onClick={handleSave}
              disabled={saving}
              data-ocid="icd.save_button"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={
          deleteTarget
            ? `${deleteTarget.code} — ${deleteTarget.description}`
            : ""
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WARD / ROOM MASTER
// ---------------------------------------------------------------------------

type WardForm = {
  name: string;
  wardType: string;
  ratePerDay: string;
  totalBeds: string;
  isActive: boolean;
};

const emptyWardForm: WardForm = {
  name: "",
  wardType: "General",
  ratePerDay: "",
  totalBeds: "",
  isActive: true,
};

const WARD_TYPES = ["General", "Semi-Private", "Private", "ICU", "NICU", "HDU"];

const wardTypeColors: Record<string, string> = {
  General: "bg-sky-100 text-sky-700 border-sky-200",
  "Semi-Private": "bg-teal-100 text-teal-700 border-teal-200",
  Private: "bg-violet-100 text-violet-700 border-violet-200",
  ICU: "bg-red-100 text-red-700 border-red-200",
  NICU: "bg-pink-100 text-pink-700 border-pink-200",
  HDU: "bg-orange-100 text-orange-700 border-orange-200",
};

function WardTab({ actor }: { actor: any }) {
  const [records, setRecords] = useState<WardMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WardMaster | null>(null);
  const [form, setForm] = useState<WardForm>(emptyWardForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WardMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (actor as any).getWards();
      setRecords(data);
    } catch {
      toast.error("Failed to load wards");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyWardForm);
    setDialogOpen(true);
  };

  const openEdit = (rec: WardMaster) => {
    setEditing(rec);
    setForm({
      name: rec.name,
      wardType: rec.wardType,
      ratePerDay: rec.ratePerDay,
      totalBeds: String(rec.totalBeds),
      isActive: rec.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.wardType.trim()) {
      toast.error("Name and Ward Type are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        totalBeds: BigInt(Number.parseInt(form.totalBeds) || 0),
      };
      if (editing) {
        const ok = await (actor as any).updateWard(editing.id, payload);
        if (ok) {
          toast.success("Ward updated");
          setDialogOpen(false);
          load();
        } else {
          toast.error("Update failed");
        }
      } else {
        const res = await (actor as any).createWard(payload);
        if ("ok" in res) {
          toast.success("Ward created");
          setDialogOpen(false);
          load();
        } else {
          toast.error(res.err ?? "Create failed");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (actor as any).deleteWard(deleteTarget.id);
      toast.success("Ward deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.wardType.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search wards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-ocid="ward.search_input"
          />
        </div>
        <Button
          size="sm"
          className="bg-hp-blue hover:bg-hp-navy text-white font-semibold gap-1.5"
          onClick={openAdd}
          data-ocid="ward.add_button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Ward
        </Button>
      </div>

      {loading ? (
        <MasterSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label="ward" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-hp-blue/30 hover:shadow-sm transition-all"
                data-ocid={`ward.item.${idx + 1}`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50 text-orange-600 shrink-0">
                  <Warehouse className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-hp-heading text-sm truncate">
                    {rec.name}
                  </p>
                  <p className="text-xs text-hp-muted">
                    {rec.totalBeds} beds
                    {rec.ratePerDay ? ` · ₹${rec.ratePerDay}/day` : ""}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "text-xs border rounded-full px-2 py-0.5 font-semibold",
                    wardTypeColors[rec.wardType] ??
                      "bg-gray-100 text-gray-600 border-gray-200",
                  )}
                >
                  {rec.wardType}
                </Badge>
                <ActiveBadge isActive={rec.isActive} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-hp-blue"
                  onClick={() => openEdit(rec)}
                  data-ocid={`ward.edit_button.${idx + 1}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-hp-muted hover:text-red-600"
                  onClick={() => setDeleteTarget(rec)}
                  data-ocid={`ward.delete_button.${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !saving && setDialogOpen(v)}
      >
        <DialogContent
          className="max-w-md max-h-[90vh] overflow-y-auto"
          data-ocid="ward.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-hp-heading flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-orange-600" />
              {editing ? "Edit Ward / Room" : "Add Ward / Room"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FieldRow label="Ward / Room Name" required>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="General Ward A"
                className="h-9 text-sm"
                data-ocid="ward.name.input"
              />
            </FieldRow>
            <FieldRow label="Ward Type" required>
              <Select
                value={form.wardType}
                onValueChange={(v) => setForm((p) => ({ ...p, wardType: v }))}
              >
                <SelectTrigger
                  className="h-9 text-sm"
                  data-ocid="ward.type.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Rate Per Day (₹)">
                <Input
                  value={form.ratePerDay}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ratePerDay: e.target.value }))
                  }
                  placeholder="2500"
                  type="number"
                  min="0"
                  className="h-9 text-sm"
                  data-ocid="ward.rate.input"
                />
              </FieldRow>
              <FieldRow label="Total Beds">
                <Input
                  value={form.totalBeds}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, totalBeds: e.target.value }))
                  }
                  placeholder="20"
                  type="number"
                  min="0"
                  className="h-9 text-sm"
                  data-ocid="ward.beds.input"
                />
              </FieldRow>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-ocid="ward.active.switch"
              />
              <Label className="text-sm text-hp-body">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-ocid="ward.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-hp-blue hover:bg-hp-navy text-white"
              onClick={handleSave}
              disabled={saving}
              data-ocid="ward.save_button"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MASTERS MODULE (Root)
// ---------------------------------------------------------------------------

export function MastersModule() {
  const { actor, isFetching } = useActor();

  if (isFetching || !actor) {
    return (
      <div
        data-ocid="masters.loading_state"
        className="flex items-center justify-center py-24"
      >
        <Loader2 className="h-6 w-6 animate-spin text-hp-blue mr-2" />
        <span className="text-hp-muted">Loading Masters...</span>
      </div>
    );
  }

  return (
    <motion.div
      key="masters"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-hp-bg"
    >
      {/* Page Header */}
      <div className="bg-gradient-to-r from-hp-blue to-hp-navy text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/15">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Masters</h1>
              <p className="text-white/70 text-xs">
                Manage reference data — Hospitals, Doctors, TPA, ICD-10, Wards
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="hospital">
          <TabsList className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm mb-6 flex flex-wrap gap-1 h-auto">
            <TabsTrigger
              value="hospital"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-hp-blue data-[state=active]:text-white flex items-center gap-1.5 px-3 py-2"
              data-ocid="masters.hospital.tab"
            >
              <Building2 className="h-3.5 w-3.5" />
              Hospital
            </TabsTrigger>
            <TabsTrigger
              value="doctor"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-hp-blue data-[state=active]:text-white flex items-center gap-1.5 px-3 py-2"
              data-ocid="masters.doctor.tab"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Doctor
            </TabsTrigger>
            <TabsTrigger
              value="tpa"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-hp-blue data-[state=active]:text-white flex items-center gap-1.5 px-3 py-2"
              data-ocid="masters.tpa.tab"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              TPA / Insurance
            </TabsTrigger>
            <TabsTrigger
              value="icd"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-hp-blue data-[state=active]:text-white flex items-center gap-1.5 px-3 py-2"
              data-ocid="masters.icd.tab"
            >
              <User className="h-3.5 w-3.5" />
              ICD-10
            </TabsTrigger>
            <TabsTrigger
              value="ward"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-hp-blue data-[state=active]:text-white flex items-center gap-1.5 px-3 py-2"
              data-ocid="masters.ward.tab"
            >
              <Warehouse className="h-3.5 w-3.5" />
              Ward / Room
            </TabsTrigger>
          </TabsList>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <TabsContent value="hospital" className="mt-0">
              <HospitalTab actor={actor} />
            </TabsContent>
            <TabsContent value="doctor" className="mt-0">
              <DoctorTab actor={actor} />
            </TabsContent>
            <TabsContent value="tpa" className="mt-0">
              <TpaTab actor={actor} />
            </TabsContent>
            <TabsContent value="icd" className="mt-0">
              <IcdTab actor={actor} />
            </TabsContent>
            <TabsContent value="ward" className="mt-0">
              <WardTab actor={actor} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </motion.div>
  );
}
