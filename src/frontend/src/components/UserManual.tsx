import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Database,
  FileCheck,
  FileText,
  FolderOpen,
  Printer,
  Receipt,
  Search,
  Users,
  Wallet,
} from "lucide-react";

const QUICK_REF = [
  {
    module: "Package Search",
    purpose: "Find medical packages by disease, name, or code",
    nav: 'Click "Find Packages" in top nav or homepage',
    icon: Search,
  },
  {
    module: "Patient Registration",
    purpose: "Register patients with ABHA ID, insurance, documents",
    nav: 'Click "RCM" in top navigation',
    icon: Users,
  },
  {
    module: "Pre-Authorization",
    purpose: "Create and track pre-auth requests for procedures",
    nav: 'Click "Pre-Auth" in top navigation',
    icon: FileCheck,
  },
  {
    module: "Clinical Documentation",
    purpose: "Manage document checklists, notes, discharge summaries",
    nav: 'Click "Clinical Docs" in top navigation',
    icon: ClipboardList,
  },
  {
    module: "Claims Submission",
    purpose: "Submit, track, and manage insurance claims",
    nav: 'Click "Claims" in top navigation',
    icon: Receipt,
  },
  {
    module: "Payment & Settlement",
    purpose: "Record payments and reconcile settlements",
    nav: 'Click "Payment" in top navigation',
    icon: Wallet,
  },
  {
    module: "Masters",
    purpose: "Manage master data: hospitals, doctors, TPAs, ICD-10",
    nav: 'Click "Masters" in top navigation',
    icon: Database,
  },
  {
    module: "Denial & Rejection",
    purpose: "Classify rejections, analytics, resubmission workflow",
    nav: 'Click "Denial" in top navigation',
    icon: AlertTriangle,
  },
  {
    module: "Local Data Manager",
    purpose: "Upload/manage XLS, Word, PDF, and images locally",
    nav: 'Click "Data" in top navigation',
    icon: FolderOpen,
  },
];

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
      <span className="font-semibold">\uD83D\uDCA1 Tip: </span>
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-1.5 list-decimal list-inside">
      {items.map((item) => (
        <li key={item} className="text-sm text-hp-body leading-relaxed">
          {item}
        </li>
      ))}
    </ol>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{title}</span>
      {badge && (
        <Badge className="text-[10px] bg-hp-blue/10 text-hp-blue border-hp-blue/20 ml-1">
          {badge}
        </Badge>
      )}
    </div>
  );
}

export function UserManual() {
  return (
    <div className="min-h-screen bg-hp-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-7 w-7 text-hp-blue" />
              <h1 className="text-2xl font-bold text-hp-body">
                AI Claim Zon \u2014 User Manual
              </h1>
            </div>
            <p className="text-hp-muted text-sm">
              Complete guide to the Health Package Finder &amp; RCM Suite (ABDM
              + NABH Ready)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            data-ocid="manual.print.button"
            className="shrink-0 gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-5">
            <h2 className="text-base font-bold text-hp-body mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-hp-blue" />
              Quick Reference \u2014 Module Navigator
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hp-border">
                    <th className="text-left pb-2 text-xs font-semibold text-hp-muted">
                      Module
                    </th>
                    <th className="text-left pb-2 text-xs font-semibold text-hp-muted">
                      Purpose
                    </th>
                    <th className="text-left pb-2 text-xs font-semibold text-hp-muted hidden sm:table-cell">
                      How to Navigate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {QUICK_REF.map((row) => (
                    <tr
                      key={row.module}
                      className="border-b border-hp-border last:border-0"
                    >
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5 font-semibold text-hp-body">
                          <row.icon className="h-3.5 w-3.5 text-hp-blue shrink-0" />
                          {row.module}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-hp-muted">{row.purpose}</td>
                      <td className="py-2 text-hp-muted hidden sm:table-cell">
                        {row.nav}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-2">
          <AccordionItem
            value="overview"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.overview.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader icon={BookOpen} title="1. Overview" />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                <strong>AI Claim Zon</strong> (Health Package Finder) is a
                comprehensive hospital Revenue Cycle Management (RCM) suite
                designed for ABDM and NABH-ready healthcare facilities. It
                combines a powerful package search engine with end-to-end claims
                management \u2014 from patient registration through payment
                reconciliation.
              </p>
              <p className="text-sm text-hp-muted leading-relaxed mt-2">
                <strong>Who is it for?</strong> Medical billing teams, insurance
                coordinators, clinical documentation staff, and hospital
                administrators who need to search health insurance packages,
                manage pre-authorizations, submit claims, and track settlements.
              </p>
              <p className="text-sm text-hp-muted leading-relaxed mt-2">
                <strong>Key capabilities:</strong> Search 3,453+ medical
                packages (AB-PMJAY 2025\u201327), Wikipedia-powered medical
                descriptions, editable clinical note generation (OT / Anesthesia
                / Discharge), full RCM pipeline from Patient \u2192 Pre-Auth
                \u2192 Clinical Docs \u2192 Claims \u2192 Payment \u2192 Denial
                Management, centralized Masters for hospitals/doctors/TPAs, and
                a local file manager for documents.
              </p>
              <TipBox>
                All RCM data is stored on the Internet Computer blockchain
                \u2014 no external database required. Files managed through
                Local Data Manager stay in your browser storage on your device.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="packages"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.packages.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={Search}
                title='2. Package Search ("Find Packages")'
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Search the complete AB-PMJAY 2025\u201327 package database of
                3,453 medical procedures and health insurance packages. Each
                package includes rates, pre-auth document requirements, claim
                document requirements, eligibility criteria, and sub-limits.
              </p>
              <Steps
                items={[
                  'Click "Find Packages" in the top navigation bar or the homepage button.',
                  'Type a disease name (e.g., "Appendectomy"), package name, or package code in the search bar.',
                  "Optionally filter by Speciality (dropdown) and/or Category (Secondary / Tertiary).",
                  'Click "View Details" on any result card to open the full package detail in a new browser tab.',
                  "In the detail view, use tabs: Details (rates & eligibility), Pre-Auth Docs, Claim Docs, Information (Wikipedia).",
                  'Click "Generate Clinical Notes" to create editable OT Notes, Anesthesia Record, or Discharge Summary as a Word document.',
                  "Download the generated document \u2014 it opens in Microsoft Word or Google Docs for editing.",
                ]}
              />
              <TipBox>
                Each package detail opens in a unique URL \u2014 you can
                bookmark it or share the link with colleagues. Open multiple
                packages in separate tabs for side-by-side comparison.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="patient"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.patient.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader icon={Users} title="3. Patient Registration" />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Register patients with full ABDM-compliant details including
                ABHA ID, insurance/payer information, and document uploads. The
                system prevents duplicate registrations and supports eligibility
                verification.
              </p>
              <Steps
                items={[
                  'Click "RCM" in the top navigation to open the Patient Registration module.',
                  'Click the "Register Patient" button (top right).',
                  "Fill in patient details: Name, DOB, Gender, Phone, Address.",
                  "Enter the ABHA ID (14-digit Ayushman Bharat Health Account identifier).",
                  "Select Payer Type (TPA / Govt Scheme / Corporate / PSU / Self Pay) \u2014 the Payer Name dropdown auto-populates from Masters.",
                  "Enter Policy Number, Policy Start Date, and Policy End Date.",
                  'Click "Check Eligibility" to verify the patient\'s insurance status.',
                  'Upload required documents using the document upload section, then click "Register Patient".',
                  "The system checks for duplicate ABHA IDs and rejects if found.",
                  'View all registered patients in the "Patient List" tab. Use status filters to find specific patients.',
                  'Click "Timeline" on any patient to see their complete history: pre-auths, claims, and payments in one view.',
                ]}
              />
              <TipBox>
                Set up TPA/Insurance masters first (in the Masters module) so
                the Payer Name dropdown is populated correctly for each payer
                type.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="preauth"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.preauth.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={FileCheck}
                title="4. Pre-Authorization"
                badge="Module 2"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Create and manage pre-authorization requests for planned
                procedures. The module links directly to registered patients and
                Master data, tracks TAT (Turnaround Time), and manages
                TPA/hospital query threads.
              </p>
              <Steps
                items={[
                  'Click "Pre-Auth" in the top navigation.',
                  'Click "New Pre-Auth" button.',
                  "Start typing a patient name or ID in the Patient search box \u2014 matching registered patients appear as a dropdown. Select one to auto-fill their details.",
                  "Enter the Diagnosis Name \u2014 the system suggests matching package codes as clickable chips.",
                  "Select a package code from the suggestions or enter manually.",
                  "Choose Scheme Type (PMJAY / Ayushman Bharat / Private / Corporate / Other).",
                  "Enter the Requested Amount.",
                  "Select the Attending Doctor from the dropdown (auto-populated from Doctor Masters).",
                  "Configure TAT (default 48 hours).",
                  "Review the auto-generated document checklist. Check off submitted documents.",
                  'Click "Submit Pre-Auth" to send the request.',
                  "Track status in the Pre-Auth list. Use filter pills: All / Pending / Approved / Rejected.",
                  "Expand any record to view/respond to TPA or hospital queries.",
                  'On Approved pre-auths, click "Submit Claim" to proceed directly to Claims with pre-filled data.',
                ]}
              />
              <TipBox>
                TAT breach alerts appear automatically when a pre-auth exceeds
                the configured turnaround time. The Dashboard tab shows approval
                rates and statistics.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="clinicaldocs"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.clinicaldocs.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={ClipboardList}
                title="5. Clinical Documentation"
                badge="Module 3"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Manage clinical documentation for admitted patients. Create
                document sets that automatically generate a combined checklist
                from multiple package codes, track missing documents in real
                time, and link directly to pre-auth requests.
              </p>
              <Steps
                items={[
                  'Click "Clinical Docs" in the top navigation.',
                  'Click "New Document Set".',
                  "Search and select the patient from registered patients.",
                  "Search and add one or more package codes \u2014 each appears as a removable chip.",
                  "The system auto-generates a combined, deduplicated checklist: Pre-Auth Documents, Claim Documents, and 6 standard Clinical Documents.",
                  "Check off each document as it is submitted. The status bar updates in real time (red = missing required docs, green = complete).",
                  "Add Doctor Notes and Discharge Summary in the text areas.",
                  'Click "Save Document Set".',
                  'In the "Document Tracker" tab, search all records, filter by status, and update workflow status (Draft / In Review / Complete).',
                  'Click "Send to Pre-Auth" on any record to attach it directly to a pre-auth request.',
                ]}
              />
              <TipBox>
                The missing document count badge (red) updates instantly as you
                tick checkboxes. A green badge means the record is ready for
                claim submission.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="claims"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.claims.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={Receipt}
                title="6. Claims Submission & Tracking"
                badge="Module 4"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Submit insurance claims linked to approved pre-authorizations.
                Track claim status through the full lifecycle: Draft \u2192
                Submitted \u2192 Under Review \u2192 Settled / Rejected.
                Rejected claims are automatically flagged in the Denial module.
              </p>
              <Steps
                items={[
                  'Click "Claims" in the top navigation, or use the "Submit Claim" button on an Approved pre-auth.',
                  'If coming from Pre-Auth, all fields are pre-filled. Otherwise, click "New Claim" and fill in patient, package, and billing details.',
                  "Enter Admission Date, Discharge Date, Billed Amount, Approved Amount, ICD Code, and Procedure Details.",
                  "Select Claim Type: Cashless or Reimbursement.",
                  "Review and complete the document checklist.",
                  'Click "Submit Claim".',
                  "Track status in the Claims list using filter pills: All / Draft / Submitted / Under Review / Settled / Rejected.",
                  'On Settled claims, click "Record Payment" to proceed directly to the Payment module.',
                  "Rejected claims automatically appear in the Denial & Rejection module for classification and resubmission.",
                ]}
              />
              <TipBox>
                Use the Workflow Pipeline banner at the top of the module to
                quickly jump between Patient \u2192 Pre-Auth \u2192 Clinical
                Docs \u2192 Claims \u2192 Payment \u2192 Denial.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="payment"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.payment.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={Wallet}
                title="7. Payment & Settlement Tracking"
                badge="Module 5"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Record, reconcile, and track payments from payers. Handles both
                partial and full settlements, discrepancy tracking, and
                settlement status management.
              </p>
              <Steps
                items={[
                  'Click "Payment" in the top navigation, or use "Record Payment" on a Settled claim.',
                  "If coming from Claims, patient and claim details are pre-filled automatically.",
                  "Enter Billed Amount, Approved Amount, and Paid Amount.",
                  "Select Payment Mode (NEFT / RTGS / Cheque / Cash / Online Transfer).",
                  "Enter Transaction Reference number and Payment Date.",
                  "Note any discrepancy in the Discrepancy Remarks field.",
                  'Click "Record Payment".',
                  "View all payment records in the list. Use settlement status filters: All / Pending / Partial / Settled / Disputed.",
                  'Click "Update Status" on any record to mark it as Settled or flag a dispute.',
                ]}
              />
              <TipBox>
                Discrepancy Remarks helps track shortfall payments from TPAs.
                Always document the reason when Paid Amount differs from
                Approved Amount.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="masters"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.masters.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader icon={Database} title="8. Masters" />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                Masters is the central configuration module. Data entered here
                automatically populates dropdowns across all other modules
                \u2014 ensuring consistent, error-free data entry throughout the
                RCM pipeline.
              </p>
              <p className="text-sm text-hp-muted leading-relaxed mt-2">
                <strong>5 master data types:</strong>
              </p>
              <ul className="mt-2 space-y-1.5 list-disc list-inside text-sm text-hp-body">
                <li>
                  <strong>Hospital</strong> \u2014 Name, Code, NABH No, ROHINI
                  ID, contact details
                </li>
                <li>
                  <strong>Doctor</strong> \u2014 Name, MCI Registration,
                  Specialisation, Department (auto-populates Attending Doctor in
                  Pre-Auth)
                </li>
                <li>
                  <strong>TPA / Insurance</strong> \u2014 Name, Code, Type (TPA
                  / Govt Scheme / Corporate / PSU), contact (auto-populates
                  Payer Name in Patient Registration)
                </li>
                <li>
                  <strong>ICD-10</strong> \u2014 Code, Description, Category
                  (for accurate claim coding)
                </li>
                <li>
                  <strong>Ward / Room</strong> \u2014 Name, Type (General /
                  Semi-Private / Private / ICU / NICU / HDU), Rate per Day,
                  Total Beds
                </li>
              </ul>
              <Steps
                items={[
                  'Click "Masters" in the top navigation.',
                  "Select the sub-tab for the master type you want to manage.",
                  "Use the Search bar to find existing records.",
                  'Click "Add" to create a new record. Fill in all fields and click "Save".',
                  "Click the edit (pencil) icon on any row to update it.",
                  "Toggle the Active/Inactive switch to enable or disable a record without deleting it.",
                  "Click the delete (trash) icon and confirm deletion to permanently remove a record.",
                ]}
              />
              <TipBox>
                Always set up Masters before using other modules. Without TPA
                masters, the Payer Name dropdown in Patient Registration will be
                empty. Without Doctor masters, the Attending Doctor field in
                Pre-Auth will have no options.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="denial"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.denial.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={AlertTriangle}
                title="9. Denial & Rejection Management"
                badge="High ROI"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                The highest-ROI module in the RCM suite. Every rejected claim is
                automatically surfaced here, classified by rejection type
                (Technical / Medical / Policy / Other), and tracked through
                resubmission or resolution. Root cause analytics help prevent
                future rejections.
              </p>
              <p className="text-sm text-hp-muted leading-relaxed mt-2">
                <strong>Auto-classification logic:</strong>
              </p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-hp-muted">
                <li>
                  <strong className="text-orange-700">Technical</strong> \u2014
                  document missing, invalid format, incomplete upload
                </li>
                <li>
                  <strong className="text-purple-700">Medical</strong> \u2014
                  not medically necessary, excluded procedure, clinical review
                  failure
                </li>
                <li>
                  <strong className="text-blue-700">Policy</strong> \u2014
                  policy lapsed, waiting period, scheme exclusion, premium issue
                </li>
                <li>
                  <strong className="text-gray-600">Other</strong> \u2014
                  unclassified rejections
                </li>
              </ul>
              <Steps
                items={[
                  'Click "Denial" in the top navigation (shows a red badge count for open denials).',
                  'The "Dashboard" tab shows Total Rejections, Open, Resubmitted, Resolved/Written Off stats, Top 10 rejection reasons table, category breakdown, and rejection by payer/scheme.',
                  'Switch to "Rejection Records" tab to see all rejected claims.',
                  "Use the Search bar to filter by patient name, claim ID, or payer.",
                  "Use Status filter pills to focus on Open / Resubmitted / Resolved / Written Off records.",
                  'Click "Root Cause Notes" to expand a record and document the analysis.',
                  'Click "Save Notes" after entering root cause notes.',
                  'Click "Resubmit" to mark a claim for resubmission \u2014 the system navigates you to Claims with the data pre-filled.',
                  'Click "Resolve" when the denial has been corrected and the claim accepted.',
                  'Click "Write Off" for claims that cannot be recovered.',
                  "A toast alert fires automatically on module load if there are any Open denials.",
                ]}
              />
              <TipBox>
                Review the Top 10 Rejection Reasons monthly to identify systemic
                documentation or coding gaps. Most hospitals can reduce denial
                rates by 30\u201350% by addressing the top 3 root causes.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="localdata"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.localdata.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader icon={FolderOpen} title="10. Local Data Manager" />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                A private, on-device file manager for all data input and output.
                Files are saved in your browser's local storage \u2014 nothing
                is uploaded to any server. Organized into 4 folders by file
                type.
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-hp-muted">
                <li>
                  <strong>XLS / Excel</strong> \u2014 package lists, billing
                  exports, data imports
                </li>
                <li>
                  <strong>Word</strong> \u2014 generated clinical notes, OT
                  notes, discharge summaries
                </li>
                <li>
                  <strong>PDF</strong> \u2014 scanned documents, reports
                </li>
                <li>
                  <strong>Images</strong> \u2014 patient photo ID, scan reports,
                  X-rays
                </li>
              </ul>
              <Steps
                items={[
                  'Click "Data" in the top navigation.',
                  "Select the appropriate folder tab (XLS, Word, PDF, Images).",
                  'Drag and drop files into the upload zone, or click "Browse" to select files.',
                  "Use the Search bar to find files by name.",
                  "Click the Download icon to save a file to your computer.",
                  "Click the Delete (trash) icon to remove a file from storage.",
                  "The storage summary at the top shows total files and space used.",
                ]}
              />
              <TipBox>
                Browser local storage has a ~5 MB limit. For larger files
                (high-res scans, full Excel exports), the app supports upgrading
                to blob-storage for unlimited capacity. Contact your
                administrator if you hit the storage limit.
              </TipBox>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="workflow"
            className="bg-white border border-hp-border rounded-xl px-4"
            data-ocid="manual.workflow.panel"
          >
            <AccordionTrigger className="text-sm font-semibold text-hp-body py-4">
              <SectionHeader
                icon={FileText}
                title="11. Workflow & Cross-Module Navigation"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-sm text-hp-body leading-relaxed">
                The RCM pipeline is designed for seamless workflow \u2014 data
                flows automatically from one module to the next without
                re-entry.
              </p>
              <p className="text-sm font-semibold text-hp-body mt-3 mb-1">
                Workflow Pipeline Banner
              </p>
              <p className="text-sm text-hp-muted">
                Every RCM module displays a pipeline banner at the top:{" "}
                <span className="font-semibold text-hp-body">
                  Patient \u2192 Pre-Auth \u2192 Clinical Docs \u2192 Claims
                  \u2192 Payment \u2192 Denial
                </span>
                . Click any step to navigate directly to that module.
              </p>
              <p className="text-sm font-semibold text-hp-body mt-3 mb-1">
                Key Workflow Shortcuts
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-sm text-hp-muted">
                <li>
                  <strong>Approved Pre-Auth \u2192 Claims:</strong> Click
                  "Submit Claim" on an approved pre-auth \u2014 navigates to
                  Claims with all data pre-filled.
                </li>
                <li>
                  <strong>Clinical Docs \u2192 Pre-Auth:</strong> Click "Send to
                  Pre-Auth" on a Clinical Doc record to attach documentation
                  directly to a pre-auth request.
                </li>
                <li>
                  <strong>Settled Claim \u2192 Payment:</strong> Click "Record
                  Payment" on a settled claim \u2014 navigates to Payment with
                  claim data pre-filled.
                </li>
                <li>
                  <strong>Rejected Claim \u2192 Denial:</strong> Rejected claims
                  automatically appear in the Denial module with
                  auto-classification. "Resubmit" navigates back to Claims with
                  data pre-filled.
                </li>
                <li>
                  <strong>Patient Timeline:</strong> Open any patient in the RCM
                  module and click the Timeline tab to see all pre-auths,
                  claims, and payments in one consolidated view.
                </li>
              </ul>
              <TipBox>
                Never navigate away mid-form without saving \u2014 the system
                does not auto-save drafts. Use the Save/Submit button before
                switching modules.
              </TipBox>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-8 pt-6 border-t border-hp-border text-center">
          <p className="text-xs text-hp-muted">
            &copy; {new Date().getFullYear()}. Built with \u2764\ufe0f using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hp-blue underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
