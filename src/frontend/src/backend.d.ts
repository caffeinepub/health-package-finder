export interface Some<T> { __kind__: "Some"; value: T; }
export interface None { __kind__: "None"; }
export type Option<T> = Some<T> | None;

// Patient types
export interface DocumentRef {
  documentId: string;
  docType: string;
}

export interface Patient {
  id: string;
  abhaId: string;
  name: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  payerType: string;
  payerName: string;
  policyNumber: string;
  policyStart: string;
  policyEnd: string;
  eligibilityStatus: string;
  eligibilityCheckedAt: bigint;
  documents: Array<DocumentRef>;
  createdAt: bigint;
  createdBy: string;
}

export interface RegisterRequest {
  abhaId: string;
  name: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  payerType: string;
  payerName: string;
  policyNumber: string;
  policyStart: string;
  policyEnd: string;
}

export type RegisterResult = { ok: string } | { err: string };

// Pre-Auth types
export interface QueryMessage {
  message: string;
  fromTPA: boolean;
  timestamp: bigint;
}

export interface DocChecklistItem {
  docName: string;
  required: boolean;
  submitted: boolean;
}

export interface PreAuthRecord {
  id: string;
  patientId: string;
  patientName: string;
  packageCode: string;
  packageName: string;
  diagnosisName: string;
  schemeType: string;
  payerName: string;
  requestedAmount: string;
  status: string;
  submittedAt: bigint;
  updatedAt: bigint;
  expectedTATHours: bigint;
  remarks: string;
  queries: Array<QueryMessage>;
  documentChecklist: Array<DocChecklistItem>;
}

export interface PreAuthRequest {
  patientId: string;
  patientName: string;
  packageCode: string;
  packageName: string;
  diagnosisName: string;
  schemeType: string;
  payerName: string;
  requestedAmount: string;
  expectedTATHours: bigint;
  documentChecklist: Array<DocChecklistItem>;
}

export type PreAuthResult = { ok: string } | { err: string };

// Clinical Documentation types
export interface ClinicalDocChecklistItem {
  docName: string;
  packageCode: string;
  required: boolean;
  submitted: boolean;
  docType: string; // "preauth" | "claim" | "clinical"
}

export interface ClinicalDocRecord {
  id: string;
  patientId: string;
  patientName: string;
  packageCodes: Array<string>;
  packageNames: Array<string>;
  doctorNotes: string;
  dischargeSummary: string;
  documentChecklist: Array<ClinicalDocChecklistItem>;
  status: string; // "Draft" | "InReview" | "Complete"
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ClinicalDocRequest {
  patientId: string;
  patientName: string;
  packageCodes: Array<string>;
  packageNames: Array<string>;
  doctorNotes: string;
  dischargeSummary: string;
  documentChecklist: Array<ClinicalDocChecklistItem>;
}

export type ClinicalDocResult = { ok: string } | { err: string };


// Payment types
export interface PaymentRecord {
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

export interface PaymentRequest {
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
}

export type PaymentResult = { ok: string } | { err: string };
// Claims types
export interface ClaimRecord {
  id: string;
  patientId: string;
  patientName: string;
  preAuthId: string;
  packageCode: string;
  packageName: string;
  diagnosisName: string;
  schemeType: string;
  payerName: string;
  admissionDate: string;
  dischargeDate: string;
  billedAmount: string;
  approvedAmount: string;
  icdCode: string;
  procedureDetails: string;
  claimType: string; // "cashless" | "reimbursement"
  status: string; // "Draft" | "Submitted" | "UnderReview" | "Settled" | "Rejected" | "Resubmitted"
  rejectionRemarks: string;
  settlementDate: string;
  documentChecklist: Array<DocChecklistItem>;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ClaimRequest {
  patientId: string;
  patientName: string;
  preAuthId: string;
  packageCode: string;
  packageName: string;
  diagnosisName: string;
  schemeType: string;
  payerName: string;
  admissionDate: string;
  dischargeDate: string;
  billedAmount: string;
  approvedAmount: string;
  icdCode: string;
  procedureDetails: string;
  claimType: string;
  documentChecklist: Array<DocChecklistItem>;
}

export type ClaimResult = { ok: string } | { err: string };


export interface backendInterface {
  // Patient functions
  registerPatient(req: RegisterRequest): Promise<RegisterResult>;
  getPatients(): Promise<Array<Patient>>;
  getPatientById(id: string): Promise<Option<Patient>>;
  getPatientByAbhaId(abhaId: string): Promise<Option<Patient>>;
  searchPatients(searchTerm: string): Promise<Array<Patient>>;
  updateEligibility(id: string, status: string): Promise<boolean>;
  addDocument(patientId: string, documentId: string, docType: string): Promise<boolean>;
  getPatientsByStatus(status: string): Promise<Array<Patient>>;
  // Pre-Auth functions
  createPreAuth(req: PreAuthRequest): Promise<PreAuthResult>;
  getPreAuths(): Promise<Array<PreAuthRecord>>;
  getPreAuthById(id: string): Promise<Option<PreAuthRecord>>;
  getPreAuthsByPatient(patientId: string): Promise<Array<PreAuthRecord>>;
  updatePreAuthStatus(id: string, status: string, remarks: string): Promise<boolean>;
  addQueryResponse(id: string, message: string, fromTPA: boolean): Promise<boolean>;
  getPreAuthsByStatus(status: string): Promise<Array<PreAuthRecord>>;
  // Clinical Documentation functions
  createClinicalDoc(req: ClinicalDocRequest): Promise<ClinicalDocResult>;
  getClinicalDocs(): Promise<Array<ClinicalDocRecord>>;
  getClinicalDocById(id: string): Promise<Option<ClinicalDocRecord>>;
  getClinicalDocsByPatient(patientId: string): Promise<Array<ClinicalDocRecord>>;
  updateClinicalDoc(
    id: string,
    doctorNotes: string,
    dischargeSummary: string,
    documentChecklist: Array<ClinicalDocChecklistItem>,
    status: string
  ): Promise<boolean>;
  getClinicalDocsByStatus(status: string): Promise<Array<ClinicalDocRecord>>;
  // Claims functions
  createClaim(req: ClaimRequest): Promise<ClaimResult>;
  getClaims(): Promise<Array<ClaimRecord>>;
  getClaimById(id: string): Promise<Option<ClaimRecord>>;
  getClaimsByPatient(patientId: string): Promise<Array<ClaimRecord>>;
  getClaimsByPreAuth(preAuthId: string): Promise<Array<ClaimRecord>>;
  updateClaimStatus(id: string, status: string, remarks: string): Promise<boolean>;
  getClaimsByStatus(status: string): Promise<Array<ClaimRecord>>;
  // Payment functions
  createPayment(req: PaymentRequest): Promise<PaymentResult>;
  getPayments(): Promise<Array<PaymentRecord>>;
  getPaymentById(id: string): Promise<Option<PaymentRecord>>;
  getPaymentsByPatient(patientId: string): Promise<Array<PaymentRecord>>;
  getPaymentsByClaimId(claimId: string): Promise<Array<PaymentRecord>>;
  getPaymentsByStatus(status: string): Promise<Array<PaymentRecord>>;
  updatePaymentStatus(id: string, settlementStatus: string, paidAmount: string, transactionRef: string, discrepancyRemarks: string): Promise<boolean>;
  // Masters functions
  createHospital(req: HospitalMasterRequest): Promise<MasterResult>;
  getHospitals(): Promise<Array<HospitalMaster>>;
  updateHospital(id: string, req: HospitalMasterRequest): Promise<boolean>;
  deleteHospital(id: string): Promise<boolean>;
  createDoctor(req: DoctorMasterRequest): Promise<MasterResult>;
  getDoctors(): Promise<Array<DoctorMaster>>;
  updateDoctor(id: string, req: DoctorMasterRequest): Promise<boolean>;
  deleteDoctor(id: string): Promise<boolean>;
  createTpa(req: TpaMasterRequest): Promise<MasterResult>;
  getTpas(): Promise<Array<TpaMaster>>;
  updateTpa(id: string, req: TpaMasterRequest): Promise<boolean>;
  deleteTpa(id: string): Promise<boolean>;
  createIcd(req: IcdMasterRequest): Promise<MasterResult>;
  getIcds(): Promise<Array<IcdMaster>>;
  updateIcd(id: string, req: IcdMasterRequest): Promise<boolean>;
  deleteIcd(id: string): Promise<boolean>;
  createWard(req: WardMasterRequest): Promise<MasterResult>;
  getWards(): Promise<Array<WardMaster>>;
  updateWard(id: string, req: WardMasterRequest): Promise<boolean>;
  deleteWard(id: string): Promise<boolean>;
}

// Masters types
export interface HospitalMaster {
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
}

export interface HospitalMasterRequest {
  name: string;
  code: string;
  address: string;
  nabhNumber: string;
  rohiniId: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface DoctorMaster {
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
}

export interface DoctorMasterRequest {
  name: string;
  registrationNumber: string;
  specialisation: string;
  department: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface TpaMaster {
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
}

export interface TpaMasterRequest {
  name: string;
  code: string;
  tpaType: string;
  contactPerson: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface IcdMaster {
  id: string;
  code: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface IcdMasterRequest {
  code: string;
  description: string;
  category: string;
  isActive: boolean;
}

export interface WardMaster {
  id: string;
  name: string;
  wardType: string;
  ratePerDay: string;
  totalBeds: bigint;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface WardMasterRequest {
  name: string;
  wardType: string;
  ratePerDay: string;
  totalBeds: bigint;
  isActive: boolean;
}

export type MasterResult = { ok: string } | { err: string };
