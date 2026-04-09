import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AppealInput {
    status: string;
    appealReason: string;
    patientId: string;
    claimId: string;
    denialId: string;
    notes: string;
}
export interface RCMStats {
    avgResolutionDays: number;
    denialRate: number;
    totalAR: number;
    pendingPreAuths: bigint;
    approvalRate: number;
    totalPaidValue: number;
    claimsByStatus: Array<[string, bigint]>;
    totalClaimsValue: number;
}
export type ClinicalDocResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface PaymentRecord {
    id: string;
    transactionRef: string;
    reconciledAt: bigint;
    patientId: string;
    createdAt: bigint;
    claimId: string;
    settlementStatus: string;
    updatedAt: bigint;
    paymentDate: string;
    patientName: string;
    paymentMode: string;
    discrepancyRemarks: string;
    paidAmount: string;
    payerName: string;
    approvedAmount: string;
    billedAmount: string;
}
export interface DoctorMasterRequest {
    name: string;
    registrationNumber: string;
    isActive: boolean;
    email: string;
    phone: string;
    department: string;
    specialisation: string;
}
export interface TpaMasterRequest {
    code: string;
    name: string;
    contactPerson: string;
    isActive: boolean;
    email: string;
    tpaType: string;
    phone: string;
}
export interface WardMaster {
    id: string;
    name: string;
    createdAt: bigint;
    ratePerDay: string;
    totalBeds: bigint;
    isActive: boolean;
    updatedAt: bigint;
    wardType: string;
}
export interface DocChecklistItem {
    submitted: boolean;
    required: boolean;
    docName: string;
}
export type ClaimResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface TpaMaster {
    id: string;
    code: string;
    name: string;
    createdAt: bigint;
    contactPerson: string;
    isActive: boolean;
    email: string;
    updatedAt: bigint;
    tpaType: string;
    phone: string;
}
export interface Patient {
    id: string;
    dob: string;
    documents: Array<DocumentRef>;
    eligibilityStatus: string;
    name: string;
    createdAt: bigint;
    createdBy: string;
    eligibilityCheckedAt: bigint;
    abhaId: string;
    address: string;
    gender: string;
    phone: string;
    policyStart: string;
    payerName: string;
    payerType: string;
    policyNumber: string;
    policyEnd: string;
}
export interface DoctorMaster {
    id: string;
    name: string;
    createdAt: bigint;
    registrationNumber: string;
    isActive: boolean;
    email: string;
    updatedAt: bigint;
    phone: string;
    department: string;
    specialisation: string;
}
export type RegisterResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface DocumentRef {
    documentId: string;
    docType: string;
}
export interface RegisterRequest {
    dob: string;
    name: string;
    abhaId: string;
    address: string;
    gender: string;
    phone: string;
    policyStart: string;
    payerName: string;
    payerType: string;
    policyNumber: string;
    policyEnd: string;
}
export interface IcdMaster {
    id: string;
    code: string;
    createdAt: bigint;
    description: string;
    isActive: boolean;
    updatedAt: bigint;
    category: string;
}
export type PreAuthResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface ClaimRecord {
    id: string;
    procedureDetails: string;
    packageName: string;
    status: string;
    rejectionRemarks: string;
    timelineEvents: Array<ClaimTimelineEvent>;
    settlementDate: string;
    patientId: string;
    admissionDate: string;
    createdAt: bigint;
    icdCode: string;
    claimType: string;
    updatedAt: bigint;
    schemeType: string;
    documentChecklist: Array<DocChecklistItem>;
    patientName: string;
    preAuthId: string;
    payerName: string;
    dischargeDate: string;
    approvedAmount: string;
    diagnosisName: string;
    billedAmount: string;
    packageCode: string;
}
export interface IcdMasterRequest {
    code: string;
    description: string;
    isActive: boolean;
    category: string;
}
export interface WardMasterRequest {
    name: string;
    ratePerDay: string;
    totalBeds: bigint;
    isActive: boolean;
    wardType: string;
}
export type PaymentResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface ClaimTimelineEvent {
    stage: string;
    notes: string;
    timestamp: bigint;
}
export interface PreAuthRequest {
    packageName: string;
    patientId: string;
    schemeType: string;
    documentChecklist: Array<DocChecklistItem>;
    requestedAmount: string;
    patientName: string;
    payerName: string;
    expectedTATHours: bigint;
    diagnosisName: string;
    packageCode: string;
}
export interface Appeal {
    id: string;
    status: string;
    appealReason: string;
    patientId: string;
    createdAt: bigint;
    submittedAt?: bigint;
    claimId: string;
    denialId: string;
    notes: string;
    resolvedAt?: bigint;
}
export interface QueryMessage {
    fromTPA: boolean;
    message: string;
    timestamp: bigint;
}
export type MasterResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export type DenialResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface DenialRecord {
    id: string;
    packageName: string;
    status: string;
    alertSent: boolean;
    rejectionRemarks: string;
    patientId: string;
    createdAt: bigint;
    resubmittedAt: bigint;
    claimId: string;
    rootCauseNotes: string;
    updatedAt: bigint;
    schemeType: string;
    rejectionCategory: string;
    patientName: string;
    payerName: string;
    resolvedAt: bigint;
    packageCode: string;
}
export interface DenialRequest {
    packageName: string;
    rejectionRemarks: string;
    patientId: string;
    claimId: string;
    rootCauseNotes: string;
    schemeType: string;
    rejectionCategory: string;
    patientName: string;
    payerName: string;
    packageCode: string;
}
export interface ClinicalDocRequest {
    doctorNotes: string;
    packageNames: Array<string>;
    patientId: string;
    dischargeSummary: string;
    documentChecklist: Array<ClinicalDocChecklistItem>;
    patientName: string;
    packageCodes: Array<string>;
}
export interface ClinicalDocRecord {
    id: string;
    doctorNotes: string;
    status: string;
    packageNames: Array<string>;
    patientId: string;
    dischargeSummary: string;
    createdAt: bigint;
    updatedAt: bigint;
    documentChecklist: Array<ClinicalDocChecklistItem>;
    patientName: string;
    packageCodes: Array<string>;
}
export interface ClinicalDocChecklistItem {
    submitted: boolean;
    required: boolean;
    docName: string;
    docType: string;
    packageCode: string;
}
export interface HospitalMasterRequest {
    nabhNumber: string;
    code: string;
    name: string;
    contactPerson: string;
    isActive: boolean;
    email: string;
    address: string;
    phone: string;
    rohiniId: string;
}
export interface PreAuthRecord {
    id: string;
    packageName: string;
    status: string;
    patientId: string;
    submittedAt: bigint;
    updatedAt: bigint;
    schemeType: string;
    documentChecklist: Array<DocChecklistItem>;
    queries: Array<QueryMessage>;
    requestedAmount: string;
    patientName: string;
    payerName: string;
    expectedTATHours: bigint;
    remarks: string;
    diagnosisName: string;
    packageCode: string;
}
export interface PaymentRequest {
    transactionRef: string;
    patientId: string;
    claimId: string;
    paymentDate: string;
    patientName: string;
    paymentMode: string;
    discrepancyRemarks: string;
    paidAmount: string;
    payerName: string;
    approvedAmount: string;
    billedAmount: string;
}
export interface ClaimRequest {
    procedureDetails: string;
    packageName: string;
    patientId: string;
    admissionDate: string;
    icdCode: string;
    claimType: string;
    schemeType: string;
    documentChecklist: Array<DocChecklistItem>;
    patientName: string;
    preAuthId: string;
    payerName: string;
    dischargeDate: string;
    approvedAmount: string;
    diagnosisName: string;
    billedAmount: string;
    packageCode: string;
}
export type AppealResult = {
    __kind__: "ok";
    ok: Appeal;
} | {
    __kind__: "err";
    err: string;
};
export interface HospitalMaster {
    id: string;
    nabhNumber: string;
    code: string;
    name: string;
    createdAt: bigint;
    contactPerson: string;
    isActive: boolean;
    email: string;
    updatedAt: bigint;
    address: string;
    phone: string;
    rohiniId: string;
}
export interface AgingAR {
    bucket61to90: Array<ClaimRecord>;
    bucket91plus: Array<ClaimRecord>;
    totalOutstanding: number;
    bucket0to30: Array<ClaimRecord>;
    bucket31to60: Array<ClaimRecord>;
}
export interface backendInterface {
    addDocument(patientId: string, documentId: string, docType: string): Promise<boolean>;
    addQueryResponse(id: string, message: string, fromTPA: boolean): Promise<boolean>;
    createAppeal(input: AppealInput): Promise<AppealResult>;
    createClaim(req: ClaimRequest): Promise<ClaimResult>;
    createClinicalDoc(req: ClinicalDocRequest): Promise<ClinicalDocResult>;
    createDenial(req: DenialRequest): Promise<DenialResult>;
    createDoctor(req: DoctorMasterRequest): Promise<MasterResult>;
    createHospital(req: HospitalMasterRequest): Promise<MasterResult>;
    createIcd(req: IcdMasterRequest): Promise<MasterResult>;
    createPayment(req: PaymentRequest): Promise<PaymentResult>;
    createPreAuth(req: PreAuthRequest): Promise<PreAuthResult>;
    createTpa(req: TpaMasterRequest): Promise<MasterResult>;
    createWard(req: WardMasterRequest): Promise<MasterResult>;
    deleteDoctor(id: string): Promise<boolean>;
    deleteHospital(id: string): Promise<boolean>;
    deleteIcd(id: string): Promise<boolean>;
    deleteTpa(id: string): Promise<boolean>;
    deleteWard(id: string): Promise<boolean>;
    getAgingAR(): Promise<AgingAR>;
    getAppealById(id: string): Promise<Appeal | null>;
    getAppeals(): Promise<Array<Appeal>>;
    getAppealsByDenialId(denialId: string): Promise<Array<Appeal>>;
    getClaimById(id: string): Promise<ClaimRecord | null>;
    getClaims(): Promise<Array<ClaimRecord>>;
    getClaimsByPatient(patientId: string): Promise<Array<ClaimRecord>>;
    getClaimsByPreAuth(preAuthId: string): Promise<Array<ClaimRecord>>;
    getClaimsByStatus(status: string): Promise<Array<ClaimRecord>>;
    getClinicalDocById(id: string): Promise<ClinicalDocRecord | null>;
    getClinicalDocs(): Promise<Array<ClinicalDocRecord>>;
    getClinicalDocsByPatient(patientId: string): Promise<Array<ClinicalDocRecord>>;
    getClinicalDocsByStatus(status: string): Promise<Array<ClinicalDocRecord>>;
    getDenialById(id: string): Promise<DenialRecord | null>;
    getDenials(): Promise<Array<DenialRecord>>;
    getDenialsByClaimId(claimId: string): Promise<Array<DenialRecord>>;
    getDenialsByStatus(status: string): Promise<Array<DenialRecord>>;
    getDoctors(): Promise<Array<DoctorMaster>>;
    getHospitals(): Promise<Array<HospitalMaster>>;
    getIcds(): Promise<Array<IcdMaster>>;
    getPatientByAbhaId(abhaId: string): Promise<Patient | null>;
    getPatientById(id: string): Promise<Patient | null>;
    getPatients(): Promise<Array<Patient>>;
    getPatientsByStatus(status: string): Promise<Array<Patient>>;
    getPaymentById(id: string): Promise<PaymentRecord | null>;
    getPayments(): Promise<Array<PaymentRecord>>;
    getPaymentsByClaimId(claimId: string): Promise<Array<PaymentRecord>>;
    getPaymentsByPatient(patientId: string): Promise<Array<PaymentRecord>>;
    getPaymentsByStatus(status: string): Promise<Array<PaymentRecord>>;
    getPreAuthById(id: string): Promise<PreAuthRecord | null>;
    getPreAuths(): Promise<Array<PreAuthRecord>>;
    getPreAuthsByPatient(patientId: string): Promise<Array<PreAuthRecord>>;
    getPreAuthsByStatus(status: string): Promise<Array<PreAuthRecord>>;
    getRCMStats(): Promise<RCMStats>;
    getTpas(): Promise<Array<TpaMaster>>;
    getWards(): Promise<Array<WardMaster>>;
    registerPatient(req: RegisterRequest): Promise<RegisterResult>;
    searchPatients(searchTerm: string): Promise<Array<Patient>>;
    updateAppealStatus(id: string, status: string, notes: string): Promise<AppealResult>;
    updateClaimStatus(id: string, status: string, remarks: string): Promise<boolean>;
    updateClinicalDoc(id: string, doctorNotes: string, dischargeSummary: string, documentChecklist: Array<ClinicalDocChecklistItem>, status: string): Promise<boolean>;
    updateDenialStatus(id: string, status: string, rootCauseNotes: string, resubmitted: boolean): Promise<boolean>;
    updateDoctor(id: string, req: DoctorMasterRequest): Promise<boolean>;
    updateEligibility(id: string, status: string): Promise<boolean>;
    updateHospital(id: string, req: HospitalMasterRequest): Promise<boolean>;
    updateIcd(id: string, req: IcdMasterRequest): Promise<boolean>;
    updatePaymentStatus(id: string, settlementStatus: string, paidAmount: string, transactionRef: string, discrepancyRemarks: string): Promise<boolean>;
    updatePreAuthStatus(id: string, status: string, remarks: string): Promise<boolean>;
    updateTpa(id: string, req: TpaMasterRequest): Promise<boolean>;
    updateWard(id: string, req: WardMasterRequest): Promise<boolean>;
}
