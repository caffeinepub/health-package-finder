import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { ClipboardList, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface HealthPackage {
  srNo: number;
  category: string;
  speciality: string;
  packageCode: string;
  packageName: string;
  packageDetails: string;
  procedureType: string;
  rate: number;
  twoHrFlag: string;
  govtReserve: string;
  procLabel: string;
  rtaFlag: string;
  implantPackage: string;
  preAuthDocument: string;
  claimDocument: string;
  specialCondition: string;
  rules: string;
}

interface PatientForm {
  patientName: string;
  age: string;
  gender: string;
  dateOfProcedure: string;
  surgeon: string;
  anaesthetist: string;
  wardBed: string;
  diagnosis: string;
}

interface DocTypes {
  otNotes: boolean;
  anaesthesiaNotes: boolean;
  dischargeSummary: boolean;
}

interface Props {
  pkg: HealthPackage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// HTML-based Word document generation (no external deps)
// Generates .doc files using Word-compatible HTML markup
// ---------------------------------------------------------------------------

const STYLE = `
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin: 2cm; color: #111; }
  h1 { font-size: 18pt; font-weight: bold; color: #1E3A5F; text-transform: uppercase;
       text-align: center; border-bottom: 3px solid #2563EB; padding-bottom: 6pt; margin-bottom: 16pt; }
  h2 { font-size: 13pt; font-weight: bold; color: #1E3A5F; text-transform: uppercase;
       border-bottom: 1px solid #2563EB; padding-bottom: 3pt; margin-top: 16pt; margin-bottom: 8pt; }
  h3 { font-size: 11pt; font-weight: bold; color: #2563EB; margin-top: 10pt; margin-bottom: 4pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
  th, td { border: 1px solid #E5E7EB; padding: 5pt 8pt; font-size: 10pt; }
  th { background-color: #EFF6FF; font-weight: bold; width: 35%; }
  .field { margin-bottom: 6pt; font-size: 11pt; }
  .field-label { font-weight: bold; }
  .blank { color: #9CA3AF; }
  .check-row { margin-bottom: 6pt; font-size: 11pt; }
  .section-note { margin-bottom: 6pt; font-size: 11pt; }
  .signature-row { margin-top: 20pt; font-size: 11pt; }
  ul { margin: 4pt 0 8pt 20pt; }
  li { margin-bottom: 3pt; font-size: 11pt; }
  .spacer { margin-top: 12pt; }
`;

function wrapDoc(title: string, body: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>
  <w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr><th>${label}</th><td>${value || "—"}</td></tr>`;
}

function field(label: string, value: string): string {
  return `<p class="field"><span class="field-label">${label}:</span> ${value || "—"}</p>`;
}

function blank(label: string, len = 40): string {
  return `<p class="field"><span class="field-label">${label}:</span> <span class="blank">${"_".repeat(len)}</span></p>`;
}

function checkRow(...items: string[]): string {
  return `<p class="check-row">${items.map((i) => `&#9744; ${i}`).join("&nbsp;&nbsp;&nbsp;")}</p>`;
}

function makeOTNotes(form: PatientForm, pkg: HealthPackage): string {
  const agGender = `${form.age || "__"} / ${form.gender || "__"}`;
  const body = `
    <h1>Operative Notes</h1>
    <table>
      ${infoRow("Date of Procedure", form.dateOfProcedure)}
      ${infoRow("Patient Name", form.patientName)}
      ${infoRow("Age / Gender", agGender)}
      ${infoRow("Ward / Bed No.", form.wardBed)}
      ${infoRow("Treating Surgeon", form.surgeon)}
      ${infoRow("Anaesthetist", form.anaesthetist)}
      ${infoRow("Procedure Performed", pkg.packageName)}
      ${infoRow("Package Code", pkg.packageCode)}
      ${infoRow("Speciality", pkg.speciality)}
      ${infoRow("Procedure Type", pkg.procedureType.replace(/[\[\]]/g, ""))}
    </table>

    <h2>Pre-Operative Diagnosis</h2>
    ${blank("Diagnosis", 50)}

    <h2>Anaesthesia</h2>
    ${checkRow("General", "Spinal", "Epidural", "Local", "MAC")}

    <h2>Operative Findings</h2>
    ${blank("Findings", 60)}

    <h2>Procedure Details</h2>
    <ol>
      <li>Patient placed in supine/prone position</li>
      <li>Parts painted and draped</li>
      <li>Incision made at ___________________________</li>
      <li>Procedure performed as per standard technique</li>
      <li>Haemostasis achieved</li>
      <li>Wound closed in layers / left open for dressing</li>
    </ol>
    ${field("Specimen Sent", "Yes / No")}
    ${blank("If Yes, details", 40)}
    ${field("Drain Placed", "Yes / No")}
    ${blank("Blood Loss (ml)", 20)}
    ${blank("IV Fluids Given (ml)", 20)}

    <h2>Post-Operative Instructions</h2>
    <ul>
      <li>NPO until alert and stable</li>
      <li>Monitor vitals every 30 min x 2 hrs</li>
      <li>IV Fluids as charted</li>
      <li>Analgesia as prescribed</li>
      <li>Wound care as per protocol</li>
    </ul>

    <div class="spacer"></div>
    <p class="signature-row">
      <span class="field-label">SURGEON SIGNATURE:</span>
      <span class="blank">${"_".repeat(30)}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">Date:</span>
      <span class="blank">${"_".repeat(15)}</span>
    </p>
  `;
  return wrapDoc("Operative Notes", body);
}

function makeAnaesthesiaNotes(form: PatientForm, pkg: HealthPackage): string {
  const agGender = `${form.age || "__"} / ${form.gender || "__"}`;
  const body = `
    <h1>Anaesthesia Record</h1>
    <table>
      ${infoRow("Date", form.dateOfProcedure)}
      ${infoRow("Patient Name", form.patientName)}
      ${infoRow("Age / Gender", agGender)}
      ${infoRow("Ward / Bed No.", form.wardBed)}
      ${infoRow("Surgeon", form.surgeon)}
      ${infoRow("Anaesthetist", form.anaesthetist)}
      ${infoRow("Procedure", pkg.packageName)}
    </table>

    <h2>Pre-Operative Assessment</h2>
    <h3>ASA Physical Status</h3>
    ${checkRow("I", "II", "III", "IV", "V")}
    <h3>Airway Assessment</h3>
    ${checkRow("Mallampati I", "II", "III", "IV")}
    ${field("Difficult Airway Anticipated", "Yes / No")}
    ${blank("Pre-existing Conditions", 40)}
    ${blank("Current Medications", 40)}
    ${blank("Known Allergies", 40)}
    <p class="field"><span class="field-label">Fasting Status:</span> Solids ___ hrs &nbsp; Liquids ___ hrs</p>

    <h2>Anaesthesia Technique</h2>
    ${checkRow("General Anaesthesia", "Spinal", "Epidural", "Combined")}
    ${checkRow("Regional Block", "MAC/Sedation", "Local")}

    <h2>Induction Agents</h2>
    ${blank("Agents", 60)}

    <h2>Maintenance</h2>
    ${blank("Details", 60)}

    <h2>Airway Management</h2>
    <p class="check-row">&#9744; Face mask &nbsp;&nbsp; &#9744; LMA &nbsp;&nbsp; &#9744; ETT (Size: ___ ) &nbsp;&nbsp; &#9744; Rapid sequence induction</p>

    <h2>Monitoring</h2>
    ${checkRow("ECG", "SpO2", "NIBP", "EtCO2", "Temperature")}
    ${checkRow("Invasive arterial line", "CVP")}

    <h2>Intraoperative Notes</h2>
    <p class="field">
      <span class="field-label">Start time:</span> ________&nbsp;&nbsp;&nbsp;
      <span class="field-label">End time:</span> ________
    </p>
    ${field("Vitals stable throughout", "Yes / No")}
    ${blank("Complications", 40)}

    <h2>Reversal</h2>
    ${blank("Agents used", 40)}
    ${field("Extubation criteria met", "Yes / No")}

    <h2>Post-Operative Plan</h2>
    ${checkRow("PACU", "HDU", "ICU", "Ward")}
    ${blank("Pain management", 40)}
    ${blank("Oxygen therapy", 40)}

    <div class="spacer"></div>
    <p class="signature-row">
      <span class="field-label">ANAESTHETIST SIGNATURE:</span>
      <span class="blank">${"_".repeat(30)}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">Date:</span>
      <span class="blank">${"_".repeat(15)}</span>
    </p>
  `;
  return wrapDoc("Anaesthesia Record", body);
}

function makeDischargeSummary(form: PatientForm, pkg: HealthPackage): string {
  const agGender = `${form.age || "__"} / ${form.gender || "__"}`;
  const body = `
    <h1>Discharge Summary</h1>
    ${blank("Hospital Name", 40)}
    <p class="field">
      <span class="field-label">Date of Admission:</span>
      <span class="blank">_________________</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">Date of Discharge:</span>
      <span class="blank">_________________</span>
    </p>

    <h2>Patient Details</h2>
    <table>
      ${infoRow("Name", form.patientName)}
      ${infoRow("Age / Gender", agGender)}
      ${infoRow("Ward / Bed No.", form.wardBed)}
      ${infoRow("Consultant", form.surgeon)}
    </table>

    <h2>Diagnosis</h2>
    ${field("Primary Diagnosis", pkg.packageName)}
    ${field("Package Code", pkg.packageCode)}
    ${field("Speciality", pkg.speciality)}
    ${blank("ICD-10 Code", 30)}
    ${blank("Secondary Diagnosis (if any)", 30)}

    <h2>Procedure Performed</h2>
    <p class="section-note">${pkg.packageName} (${pkg.packageCode})</p>
    ${field("Procedure Type", pkg.procedureType.replace(/[\[\]]/g, ""))}
    ${field("Date of Procedure", form.dateOfProcedure)}
    ${field("Surgeon", form.surgeon)}
    ${field("Anaesthetist", form.anaesthetist)}

    <h2>History of Present Illness</h2>
    ${blank("Chief Complaints", 60)}
    ${blank("Duration", 30)}

    <h2>Investigations</h2>
    ${blank("Reports", 60)}

    <h2>Treatment Given</h2>
    ${blank("Details", 60)}

    <h2>Condition on Discharge</h2>
    ${checkRow("Stable", "Improved", "Same", "Deteriorated", "Expired")}

    <h2>Discharge Medications</h2>
    <ol>
      <li><span class="blank">${"_".repeat(50)}</span></li>
      <li><span class="blank">${"_".repeat(50)}</span></li>
      <li><span class="blank">${"_".repeat(50)}</span></li>
    </ol>

    <h2>Follow-Up Instructions</h2>
    <p class="field">
      Follow up at OPD after <span class="blank">_____</span> days/weeks
    </p>
    ${blank("Referring Doctor", 30)}
    ${blank("Department", 30)}

    <h2>Diet Advice</h2>
    ${blank("Instructions", 60)}

    <h2>Activity Restriction</h2>
    ${blank("Instructions", 60)}

    <h2>Discharge Advice</h2>
    <ul>
      <li>Return immediately if fever &gt; 38.5&deg;C, worsening pain, or wound discharge</li>
      <li>Keep wound clean and dry</li>
      <li>Follow all prescribed medications strictly</li>
    </ul>

    <div class="spacer"></div>
    <p class="signature-row">
      <span class="field-label">CONSULTANT SIGNATURE:</span>
      <span class="blank">${"_".repeat(30)}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">Date:</span>
      <span class="blank">${"_".repeat(15)}</span>
    </p>
  `;
  return wrapDoc("Discharge Summary", body);
}

function downloadDoc(htmlContent: string, filename: string): void {
  const blob = new Blob([htmlContent], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "Patient";
}

export function GenerateNotesModal({ pkg, open, onOpenChange }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<PatientForm>({
    patientName: "",
    age: "",
    gender: "",
    dateOfProcedure: today,
    surgeon: "",
    anaesthetist: "",
    wardBed: "",
    diagnosis: pkg.packageName,
  });

  const [docTypes, setDocTypes] = useState<DocTypes>({
    otNotes: true,
    anaesthesiaNotes: true,
    dischargeSummary: true,
  });

  const [generating, setGenerating] = useState(false);

  const updateField = (key: keyof PatientForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDoc = (key: keyof DocTypes) => {
    setDocTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    if (!form.patientName.trim()) {
      toast.error("Patient name is required.");
      return;
    }
    const anySelected =
      docTypes.otNotes ||
      docTypes.anaesthesiaNotes ||
      docTypes.dischargeSummary;
    if (!anySelected) {
      toast.error("Please select at least one document type.");
      return;
    }

    setGenerating(true);
    try {
      const nameSlug = slugName(form.patientName);
      let count = 0;

      if (docTypes.otNotes) {
        downloadDoc(makeOTNotes(form, pkg), `OT_Notes_${nameSlug}.doc`);
        count++;
      }
      if (docTypes.anaesthesiaNotes) {
        downloadDoc(
          makeAnaesthesiaNotes(form, pkg),
          `Anesthesia_Notes_${nameSlug}.doc`,
        );
        count++;
      }
      if (docTypes.dischargeSummary) {
        downloadDoc(
          makeDischargeSummary(form, pkg),
          `Discharge_Summary_${nameSlug}.doc`,
        );
        count++;
      }

      toast.success(
        `${count} document${count > 1 ? "s" : ""} downloaded successfully!`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate documents. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0"
        data-ocid="generate_notes.dialog"
      >
        {/* Modal Header */}
        <DialogHeader className="bg-gradient-to-r from-hp-blue to-hp-navy px-6 py-5 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-lg p-2">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white font-bold text-lg">
                Generate Clinical Notes
              </DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5 line-clamp-1">
                {pkg.packageName} \u2014 {pkg.packageCode}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {/* Patient Details Section */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-hp-muted mb-4 pb-2 border-b border-hp-border">
              Patient Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Patient Name */}
              <div className="sm:col-span-2">
                <Label
                  htmlFor="patientName"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Patient Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="patientName"
                  data-ocid="generate_notes.patient_name.input"
                  value={form.patientName}
                  onChange={(e) => updateField("patientName", e.target.value)}
                  placeholder="Enter full patient name"
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Age */}
              <div>
                <Label
                  htmlFor="age"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Age (years)
                </Label>
                <Input
                  id="age"
                  data-ocid="generate_notes.age.input"
                  type="number"
                  min={0}
                  max={150}
                  value={form.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  placeholder="e.g. 45"
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Gender */}
              <div>
                <Label className="text-xs font-semibold text-hp-body mb-1.5 block">
                  Gender
                </Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => updateField("gender", v)}
                >
                  <SelectTrigger
                    data-ocid="generate_notes.gender.select"
                    className="h-9 border-hp-border rounded-lg text-sm"
                  >
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date of Procedure */}
              <div>
                <Label
                  htmlFor="dateOfProcedure"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Date of Procedure
                </Label>
                <Input
                  id="dateOfProcedure"
                  data-ocid="generate_notes.date.input"
                  type="date"
                  value={form.dateOfProcedure}
                  onChange={(e) =>
                    updateField("dateOfProcedure", e.target.value)
                  }
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Ward / Bed */}
              <div>
                <Label
                  htmlFor="wardBed"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Ward / Bed No.
                </Label>
                <Input
                  id="wardBed"
                  data-ocid="generate_notes.ward_bed.input"
                  value={form.wardBed}
                  onChange={(e) => updateField("wardBed", e.target.value)}
                  placeholder="e.g. Ward 3 / Bed 12"
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Surgeon */}
              <div>
                <Label
                  htmlFor="surgeon"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Treating Surgeon / Doctor
                </Label>
                <Input
                  id="surgeon"
                  data-ocid="generate_notes.surgeon.input"
                  value={form.surgeon}
                  onChange={(e) => updateField("surgeon", e.target.value)}
                  placeholder="Dr. Name"
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Anaesthetist */}
              <div>
                <Label
                  htmlFor="anaesthetist"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Anaesthetist Name
                </Label>
                <Input
                  id="anaesthetist"
                  data-ocid="generate_notes.anaesthetist.input"
                  value={form.anaesthetist}
                  onChange={(e) => updateField("anaesthetist", e.target.value)}
                  placeholder="Dr. Name"
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>

              {/* Diagnosis */}
              <div className="sm:col-span-2">
                <Label
                  htmlFor="diagnosis"
                  className="text-xs font-semibold text-hp-body mb-1.5 block"
                >
                  Diagnosis / ICD Code
                </Label>
                <Input
                  id="diagnosis"
                  data-ocid="generate_notes.diagnosis.input"
                  value={form.diagnosis}
                  onChange={(e) => updateField("diagnosis", e.target.value)}
                  className="h-9 border-hp-border focus:border-hp-blue rounded-lg text-sm"
                />
              </div>
            </div>
          </section>

          {/* Document Type Selection */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-hp-muted mb-4 pb-2 border-b border-hp-border">
              Select Documents to Generate
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  key: "otNotes" as keyof DocTypes,
                  label: "OT Notes",
                  desc: "Operative / Surgical notes",
                  ocid: "generate_notes.ot_notes.checkbox",
                },
                {
                  key: "anaesthesiaNotes" as keyof DocTypes,
                  label: "Anesthesia Notes",
                  desc: "Anaesthesia record sheet",
                  ocid: "generate_notes.anaesthesia.checkbox",
                },
                {
                  key: "dischargeSummary" as keyof DocTypes,
                  label: "Discharge Summary",
                  desc: "Patient discharge document",
                  ocid: "generate_notes.discharge.checkbox",
                },
              ].map((doc) => (
                <label
                  key={doc.key}
                  htmlFor={doc.key}
                  data-ocid={doc.ocid}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    docTypes[doc.key]
                      ? "border-hp-blue bg-hp-blue/5"
                      : "border-hp-border bg-white hover:border-hp-blue/40"
                  }`}
                >
                  <Checkbox
                    id={doc.key}
                    checked={docTypes[doc.key]}
                    onCheckedChange={() => toggleDoc(doc.key)}
                    className="mt-0.5 border-hp-blue data-[state=checked]:bg-hp-blue data-[state=checked]:border-hp-blue"
                  />
                  <div>
                    <p className="text-sm font-semibold text-hp-body">
                      {doc.label}
                    </p>
                    <p className="text-xs text-hp-muted mt-0.5">{doc.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Generate Button */}
          <div className="pt-2 pb-1">
            <Button
              data-ocid="generate_notes.submit_button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-11 bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl text-sm transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Documents...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Word Documents (.doc)
                </>
              )}
            </Button>
            <p className="text-xs text-hp-muted text-center mt-2">
              Files open in Microsoft Word, LibreOffice, and Google Docs
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
