import Map "mo:core/Map";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import List "mo:core/List";



actor {

  // ─────────────────────────────────────────────
  // Shared utility
  // ─────────────────────────────────────────────

  private func toLower(t : Text) : Text {
    t.toLower();
  };

  // ─────────────────────────────────────────────
  // Patient types
  // ─────────────────────────────────────────────

  public type DocumentRef = {
    documentId : Text;
    docType : Text;
  };

  public type Patient = {
    id : Text;
    abhaId : Text;
    name : Text;
    dob : Text;
    gender : Text;
    phone : Text;
    address : Text;
    payerType : Text;
    payerName : Text;
    policyNumber : Text;
    policyStart : Text;
    policyEnd : Text;
    eligibilityStatus : Text;
    eligibilityCheckedAt : Int;
    documents : [DocumentRef];
    createdAt : Int;
    createdBy : Text;
  };

  public type RegisterRequest = {
    abhaId : Text;
    name : Text;
    dob : Text;
    gender : Text;
    phone : Text;
    address : Text;
    payerType : Text;
    payerName : Text;
    policyNumber : Text;
    policyStart : Text;
    policyEnd : Text;
  };

  public type RegisterResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Patient state
  // ─────────────────────────────────────────────

  let patients = Map.empty<Text, Patient>();
  var nextId : Nat = 1;

  private func genId() : Text {
    let id = "PAT-" # nextId.toText();
    nextId += 1;
    id;
  };

  // ─────────────────────────────────────────────
  // Patient functions
  // ─────────────────────────────────────────────

  public shared func registerPatient(req : RegisterRequest) : async RegisterResult {
    if (req.abhaId != "") {
      for ((_, p) in patients.entries()) {
        if (toLower(p.abhaId) == toLower(req.abhaId)) {
          return #err("Patient with this ABHA ID already exists: " # p.id);
        };
      };
    };
    for ((_, p) in patients.entries()) {
      if (toLower(p.name) == toLower(req.name) and p.dob == req.dob) {
        return #err("Patient with same name and date of birth already exists: " # p.id);
      };
    };
    let id = genId();
    let patient : Patient = {
      id;
      abhaId = req.abhaId;
      name = req.name;
      dob = req.dob;
      gender = req.gender;
      phone = req.phone;
      address = req.address;
      payerType = req.payerType;
      payerName = req.payerName;
      policyNumber = req.policyNumber;
      policyStart = req.policyStart;
      policyEnd = req.policyEnd;
      eligibilityStatus = "NotChecked";
      eligibilityCheckedAt = 0;
      documents = [];
      createdAt = Time.now();
      createdBy = "system";
    };
    patients.add(id, patient);
    #ok(id);
  };

  public query func getPatients() : async [Patient] {
    patients.values().toArray();
  };

  public query func getPatientById(id : Text) : async ?Patient {
    patients.get(id);
  };

  public query func getPatientByAbhaId(abhaId : Text) : async ?Patient {
    for ((_, p) in patients.entries()) {
      if (toLower(p.abhaId) == toLower(abhaId)) return ?p;
    };
    null;
  };

  public query func searchPatients(searchTerm : Text) : async [Patient] {
    let term = toLower(searchTerm);
    let buf = List.empty<Patient>();
    for ((_, p) in patients.entries()) {
      if (toLower(p.name).contains(#text term) or toLower(p.abhaId).contains(#text term)) {
        buf.add(p);
      };
    };
    buf.toArray();
  };

  public shared func updateEligibility(id : Text, status : Text) : async Bool {
    switch (patients.get(id)) {
      case null { false };
      case (?p) {
        let updated : Patient = { p with
          eligibilityStatus = status;
          eligibilityCheckedAt = Time.now();
        };
        patients.add(id, updated);
        true;
      };
    };
  };

  public shared func addDocument(patientId : Text, documentId : Text, docType : Text) : async Bool {
    switch (patients.get(patientId)) {
      case null { false };
      case (?p) {
        let newDoc : DocumentRef = { documentId; docType };
        let newDocs = p.documents.concat([newDoc]);
        let updated : Patient = { p with documents = newDocs };
        patients.add(patientId, updated);
        true;
      };
    };
  };

  public query func getPatientsByStatus(status : Text) : async [Patient] {
    let buf = List.empty<Patient>();
    for ((_, p) in patients.entries()) {
      if (p.eligibilityStatus == status) { buf.add(p); };
    };
    buf.toArray();
  };

  // ─────────────────────────────────────────────
  // Pre-Auth types
  // ─────────────────────────────────────────────

  public type QueryMessage = {
    message : Text;
    fromTPA : Bool;
    timestamp : Int;
  };

  public type DocChecklistItem = {
    docName : Text;
    required : Bool;
    submitted : Bool;
  };

  public type PreAuthRecord = {
    id : Text;
    patientId : Text;
    patientName : Text;
    packageCode : Text;
    packageName : Text;
    diagnosisName : Text;
    schemeType : Text;
    payerName : Text;
    requestedAmount : Text;
    status : Text;
    submittedAt : Int;
    updatedAt : Int;
    expectedTATHours : Nat;
    remarks : Text;
    queries : [QueryMessage];
    documentChecklist : [DocChecklistItem];
  };

  public type PreAuthRequest = {
    patientId : Text;
    patientName : Text;
    packageCode : Text;
    packageName : Text;
    diagnosisName : Text;
    schemeType : Text;
    payerName : Text;
    requestedAmount : Text;
    expectedTATHours : Nat;
    documentChecklist : [DocChecklistItem];
  };

  public type PreAuthResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Pre-Auth state
  // ─────────────────────────────────────────────

  let preAuths = Map.empty<Text, PreAuthRecord>();
  var nextPreAuthId : Nat = 1;

  private func genPreAuthId() : Text {
    let id = "PREAUTH-" # nextPreAuthId.toText();
    nextPreAuthId += 1;
    id;
  };

  // ─────────────────────────────────────────────
  // Pre-Auth functions
  // ─────────────────────────────────────────────

  public shared func createPreAuth(req : PreAuthRequest) : async PreAuthResult {
    let id = genPreAuthId();
    let now = Time.now();
    let record : PreAuthRecord = {
      id;
      patientId = req.patientId;
      patientName = req.patientName;
      packageCode = req.packageCode;
      packageName = req.packageName;
      diagnosisName = req.diagnosisName;
      schemeType = req.schemeType;
      payerName = req.payerName;
      requestedAmount = req.requestedAmount;
      status = "Submitted";
      submittedAt = now;
      updatedAt = now;
      expectedTATHours = req.expectedTATHours;
      remarks = "";
      queries = [];
      documentChecklist = req.documentChecklist;
    };
    preAuths.add(id, record);
    #ok(id);
  };

  public query func getPreAuths() : async [PreAuthRecord] {
    preAuths.values().toArray();
  };

  public query func getPreAuthById(id : Text) : async ?PreAuthRecord {
    preAuths.get(id);
  };

  public query func getPreAuthsByPatient(patientId : Text) : async [PreAuthRecord] {
    let buf = List.empty<PreAuthRecord>();
    for ((_, r) in preAuths.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    buf.toArray();
  };

  public shared func updatePreAuthStatus(id : Text, status : Text, remarks : Text) : async Bool {
    switch (preAuths.get(id)) {
      case null { false };
      case (?r) {
        let updated : PreAuthRecord = { r with
          status;
          remarks;
          updatedAt = Time.now();
        };
        preAuths.add(id, updated);
        true;
      };
    };
  };

  public shared func addQueryResponse(id : Text, message : Text, fromTPA : Bool) : async Bool {
    switch (preAuths.get(id)) {
      case null { false };
      case (?r) {
        let newMsg : QueryMessage = { message; fromTPA; timestamp = Time.now() };
        let newQueries = r.queries.concat([newMsg]);
        let newStatus = if (fromTPA and r.status == "Submitted") "QueryRaised" else r.status;
        let updated : PreAuthRecord = { r with
          status = newStatus;
          updatedAt = Time.now();
          queries = newQueries;
        };
        preAuths.add(id, updated);
        true;
      };
    };
  };

  public query func getPreAuthsByStatus(status : Text) : async [PreAuthRecord] {
    let buf = List.empty<PreAuthRecord>();
    for ((_, r) in preAuths.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    buf.toArray();
  };

  // ─────────────────────────────────────────────
  // Clinical Documentation types
  // ─────────────────────────────────────────────

  public type ClinicalDocChecklistItem = {
    docName : Text;
    packageCode : Text;
    required : Bool;
    submitted : Bool;
    docType : Text;
  };

  public type ClinicalDocRecord = {
    id : Text;
    patientId : Text;
    patientName : Text;
    packageCodes : [Text];
    packageNames : [Text];
    doctorNotes : Text;
    dischargeSummary : Text;
    documentChecklist : [ClinicalDocChecklistItem];
    status : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  public type ClinicalDocRequest = {
    patientId : Text;
    patientName : Text;
    packageCodes : [Text];
    packageNames : [Text];
    doctorNotes : Text;
    dischargeSummary : Text;
    documentChecklist : [ClinicalDocChecklistItem];
  };

  public type ClinicalDocResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Clinical Documentation state
  // ─────────────────────────────────────────────

  let clinicalDocs = Map.empty<Text, ClinicalDocRecord>();
  var nextClinicalDocId : Nat = 1;

  private func genClinicalDocId() : Text {
    let id = "CDOC-" # nextClinicalDocId.toText();
    nextClinicalDocId += 1;
    id;
  };

  // ─────────────────────────────────────────────
  // Clinical Documentation functions
  // ─────────────────────────────────────────────

  public shared func createClinicalDoc(req : ClinicalDocRequest) : async ClinicalDocResult {
    let id = genClinicalDocId();
    let now = Time.now();
    let record : ClinicalDocRecord = {
      id;
      patientId = req.patientId;
      patientName = req.patientName;
      packageCodes = req.packageCodes;
      packageNames = req.packageNames;
      doctorNotes = req.doctorNotes;
      dischargeSummary = req.dischargeSummary;
      documentChecklist = req.documentChecklist;
      status = "Draft";
      createdAt = now;
      updatedAt = now;
    };
    clinicalDocs.add(id, record);
    #ok(id);
  };

  public query func getClinicalDocs() : async [ClinicalDocRecord] {
    clinicalDocs.values().toArray();
  };

  public query func getClinicalDocById(id : Text) : async ?ClinicalDocRecord {
    clinicalDocs.get(id);
  };

  public query func getClinicalDocsByPatient(patientId : Text) : async [ClinicalDocRecord] {
    let buf = List.empty<ClinicalDocRecord>();
    for ((_, r) in clinicalDocs.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    buf.toArray();
  };

  public shared func updateClinicalDoc(
    id : Text,
    doctorNotes : Text,
    dischargeSummary : Text,
    documentChecklist : [ClinicalDocChecklistItem],
    status : Text
  ) : async Bool {
    switch (clinicalDocs.get(id)) {
      case null { false };
      case (?r) {
        let updated : ClinicalDocRecord = { r with
          doctorNotes;
          dischargeSummary;
          documentChecklist;
          status;
          updatedAt = Time.now();
        };
        clinicalDocs.add(id, updated);
        true;
      };
    };
  };

  public query func getClinicalDocsByStatus(status : Text) : async [ClinicalDocRecord] {
    let buf = List.empty<ClinicalDocRecord>();
    for ((_, r) in clinicalDocs.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    buf.toArray();
  };

  // ─────────────────────────────────────────────
  // Claims types
  // ─────────────────────────────────────────────

  public type ClaimTimelineEvent = {
    stage : Text;
    timestamp : Int;
    notes : Text;
  };

  public type ClaimRecord = {
    id : Text;
    patientId : Text;
    patientName : Text;
    preAuthId : Text;
    packageCode : Text;
    packageName : Text;
    diagnosisName : Text;
    schemeType : Text;
    payerName : Text;
    admissionDate : Text;
    dischargeDate : Text;
    billedAmount : Text;
    approvedAmount : Text;
    icdCode : Text;
    procedureDetails : Text;
    claimType : Text;
    status : Text;
    rejectionRemarks : Text;
    settlementDate : Text;
    documentChecklist : [DocChecklistItem];
    timelineEvents : [ClaimTimelineEvent];
    createdAt : Int;
    updatedAt : Int;
  };

  public type ClaimRequest = {
    patientId : Text;
    patientName : Text;
    preAuthId : Text;
    packageCode : Text;
    packageName : Text;
    diagnosisName : Text;
    schemeType : Text;
    payerName : Text;
    admissionDate : Text;
    dischargeDate : Text;
    billedAmount : Text;
    approvedAmount : Text;
    icdCode : Text;
    procedureDetails : Text;
    claimType : Text;
    documentChecklist : [DocChecklistItem];
  };

  public type ClaimResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Claims state
  // ─────────────────────────────────────────────

  let claims = Map.empty<Text, ClaimRecord>();
  var nextClaimId : Nat = 1;

  private func genClaimId() : Text {
    let id = "CLM-" # nextClaimId.toText();
    nextClaimId += 1;
    id;
  };

  // ─────────────────────────────────────────────
  // Claims functions
  // ─────────────────────────────────────────────

  public shared func createClaim(req : ClaimRequest) : async ClaimResult {
    let id = genClaimId();
    let now = Time.now();
    let initEvent : ClaimTimelineEvent = { stage = "Submitted"; timestamp = now; notes = "Claim submitted" };
    let record : ClaimRecord = {
      id;
      patientId = req.patientId;
      patientName = req.patientName;
      preAuthId = req.preAuthId;
      packageCode = req.packageCode;
      packageName = req.packageName;
      diagnosisName = req.diagnosisName;
      schemeType = req.schemeType;
      payerName = req.payerName;
      admissionDate = req.admissionDate;
      dischargeDate = req.dischargeDate;
      billedAmount = req.billedAmount;
      approvedAmount = req.approvedAmount;
      icdCode = req.icdCode;
      procedureDetails = req.procedureDetails;
      claimType = req.claimType;
      status = "Submitted";
      rejectionRemarks = "";
      settlementDate = "";
      documentChecklist = req.documentChecklist;
      timelineEvents = [initEvent];
      createdAt = now;
      updatedAt = now;
    };
    claims.add(id, record);
    #ok(id);
  };

  public query func getClaims() : async [ClaimRecord] {
    claims.values().toArray();
  };

  public query func getClaimById(id : Text) : async ?ClaimRecord {
    claims.get(id);
  };

  public query func getClaimsByPatient(patientId : Text) : async [ClaimRecord] {
    let buf = List.empty<ClaimRecord>();
    for ((_, r) in claims.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    buf.toArray();
  };

  public query func getClaimsByPreAuth(preAuthId : Text) : async [ClaimRecord] {
    let buf = List.empty<ClaimRecord>();
    for ((_, r) in claims.entries()) {
      if (r.preAuthId == preAuthId) { buf.add(r); };
    };
    buf.toArray();
  };

  public shared func updateClaimStatus(id : Text, status : Text, remarks : Text) : async Bool {
    switch (claims.get(id)) {
      case null { false };
      case (?r) {
        let now = Time.now();
        let settlementDate = if (status == "Settled") {
          now.toText();
        } else {
          r.settlementDate;
        };
        let timelineEvent : ClaimTimelineEvent = { stage = status; timestamp = now; notes = remarks };
        let newTimeline = r.timelineEvents.concat([timelineEvent]);
        let updated : ClaimRecord = { r with
          status;
          rejectionRemarks = if (status == "Rejected") remarks else r.rejectionRemarks;
          settlementDate;
          timelineEvents = newTimeline;
          updatedAt = now;
        };
        claims.add(id, updated);
        true;
      };
    };
  };

  public query func getClaimsByStatus(status : Text) : async [ClaimRecord] {
    let buf = List.empty<ClaimRecord>();
    for ((_, r) in claims.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    buf.toArray();
  };

  // ─────────────────────────────────────────────
  // Payment & Settlement types
  // ─────────────────────────────────────────────

  public type PaymentRecord = {
    id : Text;
    claimId : Text;
    patientId : Text;
    patientName : Text;
    payerName : Text;
    billedAmount : Text;
    approvedAmount : Text;
    paidAmount : Text;
    paymentMode : Text;
    transactionRef : Text;
    paymentDate : Text;
    settlementStatus : Text;
    discrepancyRemarks : Text;
    reconciledAt : Int;
    createdAt : Int;
    updatedAt : Int;
  };

  public type PaymentRequest = {
    claimId : Text;
    patientId : Text;
    patientName : Text;
    payerName : Text;
    billedAmount : Text;
    approvedAmount : Text;
    paidAmount : Text;
    paymentMode : Text;
    transactionRef : Text;
    paymentDate : Text;
    discrepancyRemarks : Text;
  };

  public type PaymentResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Payment & Settlement state
  // ─────────────────────────────────────────────

  let payments = Map.empty<Text, PaymentRecord>();
  var nextPaymentId : Nat = 1;

  private func genPaymentId() : Text {
    let id = "PAY-" # nextPaymentId.toText();
    nextPaymentId += 1;
    id;
  };

  private func deriveSettlementStatus(billedAmt : Text, paidAmt : Text) : Text {
    if (paidAmt == "" or paidAmt == "0") { return "Pending"; };
    if (billedAmt == paidAmt) { return "Paid"; };
    "PartiallyPaid";
  };

  // ─────────────────────────────────────────────
  // Payment & Settlement functions
  // ─────────────────────────────────────────────

  public shared func createPayment(req : PaymentRequest) : async PaymentResult {
    let id = genPaymentId();
    let now = Time.now();
    let status = deriveSettlementStatus(req.approvedAmount, req.paidAmount);
    let record : PaymentRecord = {
      id;
      claimId = req.claimId;
      patientId = req.patientId;
      patientName = req.patientName;
      payerName = req.payerName;
      billedAmount = req.billedAmount;
      approvedAmount = req.approvedAmount;
      paidAmount = req.paidAmount;
      paymentMode = req.paymentMode;
      transactionRef = req.transactionRef;
      paymentDate = req.paymentDate;
      settlementStatus = status;
      discrepancyRemarks = req.discrepancyRemarks;
      reconciledAt = if (status == "Paid") now else 0;
      createdAt = now;
      updatedAt = now;
    };
    payments.add(id, record);
    #ok(id);
  };

  public query func getPayments() : async [PaymentRecord] {
    payments.values().toArray();
  };

  public query func getPaymentById(id : Text) : async ?PaymentRecord {
    payments.get(id);
  };

  public query func getPaymentsByPatient(patientId : Text) : async [PaymentRecord] {
    let buf = List.empty<PaymentRecord>();
    for ((_, r) in payments.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    buf.toArray();
  };

  public query func getPaymentsByClaimId(claimId : Text) : async [PaymentRecord] {
    let buf = List.empty<PaymentRecord>();
    for ((_, r) in payments.entries()) {
      if (r.claimId == claimId) { buf.add(r); };
    };
    buf.toArray();
  };

  public query func getPaymentsByStatus(status : Text) : async [PaymentRecord] {
    let buf = List.empty<PaymentRecord>();
    for ((_, r) in payments.entries()) {
      if (r.settlementStatus == status) { buf.add(r); };
    };
    buf.toArray();
  };

  public shared func updatePaymentStatus(
    id : Text,
    settlementStatus : Text,
    paidAmount : Text,
    transactionRef : Text,
    discrepancyRemarks : Text
  ) : async Bool {
    switch (payments.get(id)) {
      case null { false };
      case (?r) {
        let now = Time.now();
        let updated : PaymentRecord = { r with
          paidAmount;
          transactionRef;
          settlementStatus;
          discrepancyRemarks;
          reconciledAt = if (settlementStatus == "Paid") now else r.reconciledAt;
          updatedAt = now;
        };
        payments.add(id, updated);
        true;
      };
    };
  };

  // ─────────────────────────────────────────────
  // Masters: shared result type
  // ─────────────────────────────────────────────

  public type MasterResult = { #ok : Text; #err : Text };

  // ─────────────────────────────────────────────
  // Hospital Master
  // ─────────────────────────────────────────────

  public type HospitalMaster = {
    id : Text;
    name : Text;
    code : Text;
    address : Text;
    nabhNumber : Text;
    rohiniId : Text;
    contactPerson : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
    createdAt : Int;
    updatedAt : Int;
  };

  public type HospitalMasterRequest = {
    name : Text;
    code : Text;
    address : Text;
    nabhNumber : Text;
    rohiniId : Text;
    contactPerson : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
  };

  let hospitals = Map.empty<Text, HospitalMaster>();
  var nextHospitalId : Nat = 1;

  public shared func createHospital(req : HospitalMasterRequest) : async MasterResult {
    for ((_, h) in hospitals.entries()) {
      if (toLower(h.code) == toLower(req.code)) {
        return #err("Hospital with this code already exists: " # h.id);
      };
    };
    let id = "HOSP-" # nextHospitalId.toText();
    nextHospitalId += 1;
    let now = Time.now();
    hospitals.add(id, {
      id; name = req.name; code = req.code; address = req.address;
      nabhNumber = req.nabhNumber; rohiniId = req.rohiniId;
      contactPerson = req.contactPerson; phone = req.phone;
      email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getHospitals() : async [HospitalMaster] {
    hospitals.values().toArray();
  };

  public shared func updateHospital(id : Text, req : HospitalMasterRequest) : async Bool {
    switch (hospitals.get(id)) {
      case null { false };
      case (?h) {
        hospitals.add(id, {
          id; name = req.name; code = req.code; address = req.address;
          nabhNumber = req.nabhNumber; rohiniId = req.rohiniId;
          contactPerson = req.contactPerson; phone = req.phone;
          email = req.email; isActive = req.isActive;
          createdAt = h.createdAt; updatedAt = Time.now()
        });
        true;
      };
    };
  };

  public shared func deleteHospital(id : Text) : async Bool {
    switch (hospitals.get(id)) {
      case null { false };
      case (_) { hospitals.remove(id); true };
    };
  };

  // ─────────────────────────────────────────────
  // Doctor Master
  // ─────────────────────────────────────────────

  public type DoctorMaster = {
    id : Text;
    name : Text;
    registrationNumber : Text;
    specialisation : Text;
    department : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
    createdAt : Int;
    updatedAt : Int;
  };

  public type DoctorMasterRequest = {
    name : Text;
    registrationNumber : Text;
    specialisation : Text;
    department : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
  };

  let doctors = Map.empty<Text, DoctorMaster>();
  var nextDoctorId : Nat = 1;

  public shared func createDoctor(req : DoctorMasterRequest) : async MasterResult {
    if (req.registrationNumber != "") {
      for ((_, d) in doctors.entries()) {
        if (toLower(d.registrationNumber) == toLower(req.registrationNumber)) {
          return #err("Doctor with this registration number already exists: " # d.id);
        };
      };
    };
    let id = "DOC-" # nextDoctorId.toText();
    nextDoctorId += 1;
    let now = Time.now();
    doctors.add(id, {
      id; name = req.name; registrationNumber = req.registrationNumber;
      specialisation = req.specialisation; department = req.department;
      phone = req.phone; email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getDoctors() : async [DoctorMaster] {
    doctors.values().toArray();
  };

  public shared func updateDoctor(id : Text, req : DoctorMasterRequest) : async Bool {
    switch (doctors.get(id)) {
      case null { false };
      case (?d) {
        doctors.add(id, {
          id; name = req.name; registrationNumber = req.registrationNumber;
          specialisation = req.specialisation; department = req.department;
          phone = req.phone; email = req.email; isActive = req.isActive;
          createdAt = d.createdAt; updatedAt = Time.now()
        });
        true;
      };
    };
  };

  public shared func deleteDoctor(id : Text) : async Bool {
    switch (doctors.get(id)) {
      case null { false };
      case (_) { doctors.remove(id); true };
    };
  };

  // ─────────────────────────────────────────────
  // TPA / Insurance Master
  // ─────────────────────────────────────────────

  public type TpaMaster = {
    id : Text;
    name : Text;
    code : Text;
    tpaType : Text;
    contactPerson : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
    createdAt : Int;
    updatedAt : Int;
  };

  public type TpaMasterRequest = {
    name : Text;
    code : Text;
    tpaType : Text;
    contactPerson : Text;
    phone : Text;
    email : Text;
    isActive : Bool;
  };

  let tpas = Map.empty<Text, TpaMaster>();
  var nextTpaId : Nat = 1;

  public shared func createTpa(req : TpaMasterRequest) : async MasterResult {
    for ((_, t) in tpas.entries()) {
      if (toLower(t.code) == toLower(req.code)) {
        return #err("TPA with this code already exists: " # t.id);
      };
    };
    let id = "TPA-" # nextTpaId.toText();
    nextTpaId += 1;
    let now = Time.now();
    tpas.add(id, {
      id; name = req.name; code = req.code; tpaType = req.tpaType;
      contactPerson = req.contactPerson; phone = req.phone;
      email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getTpas() : async [TpaMaster] {
    tpas.values().toArray();
  };

  public shared func updateTpa(id : Text, req : TpaMasterRequest) : async Bool {
    switch (tpas.get(id)) {
      case null { false };
      case (?t) {
        tpas.add(id, {
          id; name = req.name; code = req.code; tpaType = req.tpaType;
          contactPerson = req.contactPerson; phone = req.phone;
          email = req.email; isActive = req.isActive;
          createdAt = t.createdAt; updatedAt = Time.now()
        });
        true;
      };
    };
  };

  public shared func deleteTpa(id : Text) : async Bool {
    switch (tpas.get(id)) {
      case null { false };
      case (_) { tpas.remove(id); true };
    };
  };

  // ─────────────────────────────────────────────
  // ICD-10 Code Master
  // ─────────────────────────────────────────────

  public type IcdMaster = {
    id : Text;
    code : Text;
    description : Text;
    category : Text;
    isActive : Bool;
    createdAt : Int;
    updatedAt : Int;
  };

  public type IcdMasterRequest = {
    code : Text;
    description : Text;
    category : Text;
    isActive : Bool;
  };

  let icds = Map.empty<Text, IcdMaster>();
  var nextIcdId : Nat = 1;

  public shared func createIcd(req : IcdMasterRequest) : async MasterResult {
    for ((_, i) in icds.entries()) {
      if (toLower(i.code) == toLower(req.code)) {
        return #err("ICD code already exists: " # i.id);
      };
    };
    let id = "ICD-" # nextIcdId.toText();
    nextIcdId += 1;
    let now = Time.now();
    icds.add(id, {
      id; code = req.code; description = req.description;
      category = req.category; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getIcds() : async [IcdMaster] {
    icds.values().toArray();
  };

  public shared func updateIcd(id : Text, req : IcdMasterRequest) : async Bool {
    switch (icds.get(id)) {
      case null { false };
      case (?i) {
        icds.add(id, {
          id; code = req.code; description = req.description;
          category = req.category; isActive = req.isActive;
          createdAt = i.createdAt; updatedAt = Time.now()
        });
        true;
      };
    };
  };

  public shared func deleteIcd(id : Text) : async Bool {
    switch (icds.get(id)) {
      case null { false };
      case (_) { icds.remove(id); true };
    };
  };

  // ─────────────────────────────────────────────
  // Ward / Room Type Master
  // ─────────────────────────────────────────────

  public type WardMaster = {
    id : Text;
    name : Text;
    wardType : Text;
    ratePerDay : Text;
    totalBeds : Nat;
    isActive : Bool;
    createdAt : Int;
    updatedAt : Int;
  };

  public type WardMasterRequest = {
    name : Text;
    wardType : Text;
    ratePerDay : Text;
    totalBeds : Nat;
    isActive : Bool;
  };

  let wards = Map.empty<Text, WardMaster>();
  var nextWardId : Nat = 1;

  public shared func createWard(req : WardMasterRequest) : async MasterResult {
    let id = "WARD-" # nextWardId.toText();
    nextWardId += 1;
    let now = Time.now();
    wards.add(id, {
      id; name = req.name; wardType = req.wardType;
      ratePerDay = req.ratePerDay; totalBeds = req.totalBeds;
      isActive = req.isActive; createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getWards() : async [WardMaster] {
    wards.values().toArray();
  };

  public shared func updateWard(id : Text, req : WardMasterRequest) : async Bool {
    switch (wards.get(id)) {
      case null { false };
      case (?w) {
        wards.add(id, {
          id; name = req.name; wardType = req.wardType;
          ratePerDay = req.ratePerDay; totalBeds = req.totalBeds;
          isActive = req.isActive; createdAt = w.createdAt; updatedAt = Time.now()
        });
        true;
      };
    };
  };

  public shared func deleteWard(id : Text) : async Bool {
    switch (wards.get(id)) {
      case null { false };
      case (_) { wards.remove(id); true };
    };
  };

  // ─────────────────────────────────────────────
  // Denial & Rejection Management
  // ─────────────────────────────────────────────

  public type DenialRecord = {
    id : Text;
    claimId : Text;
    patientId : Text;
    patientName : Text;
    payerName : Text;
    schemeType : Text;
    packageCode : Text;
    packageName : Text;
    rejectionRemarks : Text;
    rejectionCategory : Text;
    rootCauseNotes : Text;
    alertSent : Bool;
    resubmittedAt : Int;
    resolvedAt : Int;
    status : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  public type DenialRequest = {
    claimId : Text;
    patientId : Text;
    patientName : Text;
    payerName : Text;
    schemeType : Text;
    packageCode : Text;
    packageName : Text;
    rejectionRemarks : Text;
    rejectionCategory : Text;
    rootCauseNotes : Text;
  };

  public type DenialResult = { #ok : Text; #err : Text };

  let denials = Map.empty<Text, DenialRecord>();
  var nextDenialId : Nat = 1;

  private func genDenialId() : Text {
    let id = "DNL-" # nextDenialId.toText();
    nextDenialId += 1;
    id;
  };

  public shared func createDenial(req : DenialRequest) : async DenialResult {
    for ((_, d) in denials.entries()) {
      if (d.claimId == req.claimId) {
        return #err("Denial record already exists for claim: " # req.claimId);
      };
    };
    let id = genDenialId();
    let now = Time.now();
    denials.add(id, {
      id; claimId = req.claimId; patientId = req.patientId;
      patientName = req.patientName; payerName = req.payerName;
      schemeType = req.schemeType; packageCode = req.packageCode;
      packageName = req.packageName; rejectionRemarks = req.rejectionRemarks;
      rejectionCategory = req.rejectionCategory; rootCauseNotes = req.rootCauseNotes;
      alertSent = false; resubmittedAt = 0; resolvedAt = 0;
      status = "Open"; createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getDenials() : async [DenialRecord] {
    denials.values().toArray();
  };

  public query func getDenialById(id : Text) : async ?DenialRecord {
    denials.get(id);
  };

  public query func getDenialsByClaimId(claimId : Text) : async [DenialRecord] {
    let buf = List.empty<DenialRecord>();
    for ((_, d) in denials.entries()) {
      if (d.claimId == claimId) { buf.add(d); };
    };
    buf.toArray();
  };

  public query func getDenialsByStatus(status : Text) : async [DenialRecord] {
    let buf = List.empty<DenialRecord>();
    for ((_, d) in denials.entries()) {
      if (toLower(d.status) == toLower(status)) { buf.add(d); };
    };
    buf.toArray();
  };

  public shared func updateDenialStatus(
    id : Text,
    status : Text,
    rootCauseNotes : Text,
    resubmitted : Bool
  ) : async Bool {
    switch (denials.get(id)) {
      case null { false };
      case (?d) {
        let now = Time.now();
        denials.add(id, { d with
          rootCauseNotes = if (rootCauseNotes == "") d.rootCauseNotes else rootCauseNotes;
          alertSent = true;
          resubmittedAt = if (resubmitted) now else d.resubmittedAt;
          resolvedAt = if (status == "Resolved" or status == "WrittenOff") now else d.resolvedAt;
          status;
          updatedAt = now;
        });
        true;
      };
    };
  };

  // ─────────────────────────────────────────────
  // Appeal Management
  // ─────────────────────────────────────────────

  public type Appeal = {
    id : Text;
    denialId : Text;
    patientId : Text;
    claimId : Text;
    status : Text;
    appealReason : Text;
    submittedAt : ?Int;
    resolvedAt : ?Int;
    notes : Text;
    createdAt : Int;
  };

  public type AppealInput = {
    denialId : Text;
    patientId : Text;
    claimId : Text;
    status : Text;
    appealReason : Text;
    notes : Text;
  };

  public type AppealResult = { #ok : Appeal; #err : Text };

  let appeals = Map.empty<Text, Appeal>();
  var nextAppealId : Nat = 1;

  private func genAppealId() : Text {
    let id = "APL-" # nextAppealId.toText();
    nextAppealId += 1;
    id;
  };

  public shared func createAppeal(input : AppealInput) : async AppealResult {
    let id = genAppealId();
    let now = Time.now();
    let appeal : Appeal = {
      id;
      denialId = input.denialId;
      patientId = input.patientId;
      claimId = input.claimId;
      status = input.status;
      appealReason = input.appealReason;
      submittedAt = if (input.status == "Submitted") ?now else null;
      resolvedAt = null;
      notes = input.notes;
      createdAt = now;
    };
    appeals.add(id, appeal);
    #ok(appeal);
  };

  public query func getAppeals() : async [Appeal] {
    appeals.values().toArray();
  };

  public query func getAppealById(id : Text) : async ?Appeal {
    appeals.get(id);
  };

  public query func getAppealsByDenialId(denialId : Text) : async [Appeal] {
    let buf = List.empty<Appeal>();
    for ((_, a) in appeals.entries()) {
      if (a.denialId == denialId) { buf.add(a); };
    };
    buf.toArray();
  };

  public shared func updateAppealStatus(id : Text, status : Text, notes : Text) : async AppealResult {
    switch (appeals.get(id)) {
      case null { #err("Appeal not found: " # id) };
      case (?a) {
        let now = Time.now();
        let updated : Appeal = { a with
          status;
          notes = if (notes == "") a.notes else notes;
          submittedAt = if (status == "Submitted" and a.submittedAt == null) ?now else a.submittedAt;
          resolvedAt = if (status == "Approved" or status == "Rejected") ?now else a.resolvedAt;
        };
        appeals.add(id, updated);
        #ok(updated);
      };
    };
  };

  // ─────────────────────────────────────────────
  // RCM Analytics
  // ─────────────────────────────────────────────

  public type RCMStats = {
    totalAR : Float;
    approvalRate : Float;
    denialRate : Float;
    avgResolutionDays : Float;
    pendingPreAuths : Nat;
    claimsByStatus : [(Text, Nat)];
    totalClaimsValue : Float;
    totalPaidValue : Float;
  };

  public type AgingAR = {
    bucket0to30 : [ClaimRecord];
    bucket31to60 : [ClaimRecord];
    bucket61to90 : [ClaimRecord];
    bucket91plus : [ClaimRecord];
    totalOutstanding : Float;
  };

  // Parse a currency text like "50000" or "75000.50" into Float
  private func parseFloat(t : Text) : Float {
    if (t == "" or t == "0") { return 0.0; };
    // Split on decimal point
    let parts = t.split(#char '.');
    let arr = parts.toArray();
    if (arr.size() == 0) { return 0.0; };
    let wholePart = switch (Nat.fromText(arr[0])) {
      case (?n) n.toFloat();
      case null 0.0;
    };
    if (arr.size() == 1) { return wholePart; };
    let fracText = arr[1];
    let fracNat = switch (Nat.fromText(fracText)) {
      case (?n) n;
      case null 0;
    };
    let divisor = Nat.pow(10, fracText.size()).toFloat();
    wholePart + fracNat.toFloat() / divisor;
  };

  private func daysSince(ts : Int) : Float {
    let nowNs : Int = Time.now();
    let diffNs : Int = nowNs - ts;
    if (diffNs <= 0) { return 0.0; };
    diffNs.toFloat() / 86_400_000_000_000.0;
  };

  public query func getRCMStats() : async RCMStats {
    var totalBilled : Float = 0.0;
    var totalPaid : Float = 0.0;
    var approvedCount : Nat = 0;
    var rejectedCount : Nat = 0;
    var totalClaims : Nat = 0;

    // Claims value and status breakdown
    let statusMap = Map.empty<Text, Nat>();
    for ((_, c) in claims.entries()) {
      totalClaims += 1;
      totalBilled += parseFloat(c.billedAmount);
      if (c.status == "Approved") { approvedCount += 1; };
      if (c.status == "Rejected") { rejectedCount += 1; };
      switch (statusMap.get(c.status)) {
        case (?count) { statusMap.add(c.status, count + 1); };
        case null { statusMap.add(c.status, 1); };
      };
    };

    // Total paid from payments
    for ((_, p) in payments.entries()) {
      totalPaid += parseFloat(p.paidAmount);
    };

    // Pending pre-auths
    var pendingCount : Nat = 0;
    for ((_, r) in preAuths.entries()) {
      if (r.status == "Submitted" or r.status == "QueryRaised") { pendingCount += 1; };
    };

    // Avg resolution days for resolved denials
    var resolvedCount : Nat = 0;
    var totalResolutionDays : Float = 0.0;
    for ((_, d) in denials.entries()) {
      if (d.resolvedAt > 0) {
        resolvedCount += 1;
        let days = (d.resolvedAt - d.createdAt).toFloat() / 86_400_000_000_000.0;
        totalResolutionDays += days;
      };
    };
    let avgResolutionDays = if (resolvedCount == 0) 0.0 else totalResolutionDays / resolvedCount.toFloat();

    let approvalRate = if (totalClaims == 0) 0.0 else approvedCount.toFloat() / totalClaims.toFloat() * 100.0;
    let denialRate = if (totalClaims == 0) 0.0 else rejectedCount.toFloat() / totalClaims.toFloat() * 100.0;

    {
      totalAR = totalBilled - totalPaid;
      approvalRate;
      denialRate;
      avgResolutionDays;
      pendingPreAuths = pendingCount;
      claimsByStatus = statusMap.toArray();
      totalClaimsValue = totalBilled;
      totalPaidValue = totalPaid;
    };
  };

  public query func getAgingAR() : async AgingAR {
    let b0to30 = List.empty<ClaimRecord>();
    let b31to60 = List.empty<ClaimRecord>();
    let b61to90 = List.empty<ClaimRecord>();
    let b91plus = List.empty<ClaimRecord>();
    var totalOutstanding : Float = 0.0;

    for ((_, c) in claims.entries()) {
      // Only consider open/unpaid claims
      if (c.status != "Settled" and c.status != "Rejected") {
        let days = daysSince(c.createdAt);
        let billed = parseFloat(c.billedAmount);
        totalOutstanding += billed;
        if (days <= 30.0) { b0to30.add(c); }
        else if (days <= 60.0) { b31to60.add(c); }
        else if (days <= 90.0) { b61to90.add(c); }
        else { b91plus.add(c); };
      };
    };

    {
      bucket0to30 = b0to30.toArray();
      bucket31to60 = b31to60.toArray();
      bucket61to90 = b61to90.toArray();
      bucket91plus = b91plus.toArray();
      totalOutstanding;
    };
  };
};
