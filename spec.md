# Health Package Finder

## Current State

The app has a full RCM suite with 6 live modules:
1. Patient Registration (RCMModule)
2. Pre-Authorization (PreAuthModule)
3. Clinical Documentation (ClinicalDocsModule)
4. Claims Submission & Tracking (ClaimsModule)
5. Payment & Settlement (PaymentModule)
6. Masters (MastersModule)
7. Local Data Source Manager (LocalDataSourceModule)

Navigation tabs: Home, Find Packages, About, Patient, Pre-Auth, Clinical Docs, Claims, Payment, Masters, Data.

Backend has full CRUD for: patients, preAuths, clinicalDocs, claims, payments, and all 5 master types.

Claims can have status: Draft, Submitted, UnderReview, Settled, Rejected, Resubmitted.

## Requested Changes (Diff)

### Add
- **Denial & Rejection Management Module** (`DenialModule.tsx`):
  - New nav tab "Denial" in the header
  - Two views: Dashboard tab + Rejection Records tab
  - Dashboard: stats cards (total rejections, by category), "Top 10 Rejection Reasons" bar chart (using Recharts), approval vs rejection rate donut chart, rejection trend over time
  - Rejection Records tab: list of all rejected claims from backend (`getClaimsByStatus('Rejected')`), enriched with rejection reason classification
  - Each rejection record shows: Claim ID, Patient Name, Payer, Rejection Reason (from rejectionRemarks), Category (Technical/Medical/Policy), TAT breach flag, action buttons
  - Classification logic: auto-classify rejection remarks into Technical (e.g., missing docs, format errors), Medical (e.g., not medically necessary, excluded procedure), Policy (e.g., policy lapsed, exclusion clause)
  - Auto-alert badge: unreviewed rejections show a red badge count on the "Denial" nav tab
  - Resubmission workflow: "Resubmit" button on each rejection record that navigates to Claims module with pre-filled data and sets status to Resubmitted
  - Root cause analytics: breakdown by payer, by scheme type, by package category
  - Denial record stores: claimId, patientId, patientName, payerName, rejectionRemarks, rejectionCategory, alertSent, resubmittedAt, rootCause notes, resolvedAt — stored in backend
  - New backend functions: `createDenial`, `getDenials`, `getDenialById`, `getDenialsByClaimId`, `updateDenialStatus`

- **User Manual** (`UserManual.tsx`):
  - New nav tab "Help" in the header
  - Accordion-based comprehensive user manual covering all modules
  - Sections: Overview, Package Search, RCM Workflow, Patient Registration, Pre-Authorization, Clinical Documentation, Claims, Payment, Masters, Denial & Rejection, Local Data Manager
  - Each section: purpose, step-by-step instructions, tips and notes
  - Quick reference table at the top (module name, purpose, navigation)
  - Print-friendly layout

### Modify
- **App.tsx**: Add `denial` and `manual` to the `activePage` type union; add nav buttons for "Denial" (with red badge for unreviewed rejections) and "Help"; render `DenialModule` and `UserManual` components
- **WorkflowBanner.tsx**: Add Denial as optional step after Payment in the pipeline
- **backend.d.ts**: Add DenialRecord, DenialRequest, DenialResult types and backendInterface methods
- **main.mo**: Add denial record types, stable storage, and CRUD functions

### Remove
- Nothing removed

## Implementation Plan

1. Extend `main.mo` with DenialRecord type, stable vars, genDenialId, createDenial, getDenials, getDenialById, getDenialsByClaimId, updateDenialStatus, preupgrade/postupgrade hooks updated
2. Extend `backend.d.ts` with DenialRecord, DenialRequest, DenialResult, and new backendInterface methods
3. Build `DenialModule.tsx` with Dashboard + Records tabs, auto-classification, Recharts charts, resubmit workflow
4. Build `UserManual.tsx` with full accordion sections for all 9+ modules
5. Update `App.tsx`: add page types, nav buttons, badge counter for denials, render both new components
6. Update `WorkflowBanner.tsx` to include Denial step
