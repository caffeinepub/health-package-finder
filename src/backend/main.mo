import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Buffer "mo:base/Buffer";
import Char "mo:base/Char";

actor {

  // ─────────────────────────────────────────────
  // Shared utility
  // ─────────────────────────────────────────────

  private func toLower(t : Text) : Text {
    var result = "";
    for (c in t.chars()) {
      let code = Char.toNat32(c);
      if (code >= 65 and code <= 90) {
        result #= Char.toText(Char.fromNat32(code + 32));
      } else {
        result #= Char.toText(c);
      };
    };
    result;
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

  stable var apiKey : Text = "";
  stable var patientEntries : [(Text, Patient)] = [];
  stable var nextId : Nat = 1;
  transient var patients : HashMap.HashMap<Text, Patient> =
    HashMap.fromIter<Text, Patient>(patientEntries.vals(), 10, Text.equal, Text.hash);

  private func genId() : Text {
    let id = "PAT-" # Nat.toText(nextId);
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
    patients.put(id, patient);
    #ok(id);
  };

  public query func getPatients() : async [Patient] {
    Iter.toArray(patients.vals());
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
    let buf = Buffer.Buffer<Patient>(4);
    for ((_, p) in patients.entries()) {
      if (Text.contains(toLower(p.name), #text term) or Text.contains(toLower(p.abhaId), #text term)) {
        buf.add(p);
      };
    };
    Buffer.toArray(buf);
  };

  public shared func updateEligibility(id : Text, status : Text) : async Bool {
    switch (patients.get(id)) {
      case null { false };
      case (?p) {
        let updated : Patient = {
          id = p.id;
          abhaId = p.abhaId;
          name = p.name;
          dob = p.dob;
          gender = p.gender;
          phone = p.phone;
          address = p.address;
          payerType = p.payerType;
          payerName = p.payerName;
          policyNumber = p.policyNumber;
          policyStart = p.policyStart;
          policyEnd = p.policyEnd;
          eligibilityStatus = status;
          eligibilityCheckedAt = Time.now();
          documents = p.documents;
          createdAt = p.createdAt;
          createdBy = p.createdBy;
        };
        patients.put(id, updated);
        true;
      };
    };
  };

  public shared func addDocument(patientId : Text, documentId : Text, docType : Text) : async Bool {
    switch (patients.get(patientId)) {
      case null { false };
      case (?p) {
        let newDoc : DocumentRef = { documentId; docType };
        let buf = Buffer.Buffer<DocumentRef>(p.documents.size() + 1);
        for (d in p.documents.vals()) { buf.add(d); };
        buf.add(newDoc);
        let updated : Patient = {
          id = p.id; abhaId = p.abhaId; name = p.name; dob = p.dob;
          gender = p.gender; phone = p.phone; address = p.address;
          payerType = p.payerType; payerName = p.payerName;
          policyNumber = p.policyNumber; policyStart = p.policyStart;
          policyEnd = p.policyEnd; eligibilityStatus = p.eligibilityStatus;
          eligibilityCheckedAt = p.eligibilityCheckedAt;
          documents = Buffer.toArray(buf);
          createdAt = p.createdAt; createdBy = p.createdBy;
        };
        patients.put(patientId, updated);
        true;
      };
    };
  };

  public query func getPatientsByStatus(status : Text) : async [Patient] {
    let buf = Buffer.Buffer<Patient>(4);
    for ((_, p) in patients.entries()) {
      if (p.eligibilityStatus == status) { buf.add(p); };
    };
    Buffer.toArray(buf);
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

  stable var preAuthEntries : [(Text, PreAuthRecord)] = [];
  stable var nextPreAuthId : Nat = 1;
  transient var preAuths : HashMap.HashMap<Text, PreAuthRecord> =
    HashMap.fromIter<Text, PreAuthRecord>(preAuthEntries.vals(), 10, Text.equal, Text.hash);

  private func genPreAuthId() : Text {
    let id = "PREAUTH-" # Nat.toText(nextPreAuthId);
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
    preAuths.put(id, record);
    #ok(id);
  };

  public query func getPreAuths() : async [PreAuthRecord] {
    Iter.toArray(preAuths.vals());
  };

  public query func getPreAuthById(id : Text) : async ?PreAuthRecord {
    preAuths.get(id);
  };

  public query func getPreAuthsByPatient(patientId : Text) : async [PreAuthRecord] {
    let buf = Buffer.Buffer<PreAuthRecord>(4);
    for ((_, r) in preAuths.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  public shared func updatePreAuthStatus(id : Text, status : Text, remarks : Text) : async Bool {
    switch (preAuths.get(id)) {
      case null { false };
      case (?r) {
        let updated : PreAuthRecord = {
          id = r.id; patientId = r.patientId; patientName = r.patientName;
          packageCode = r.packageCode; packageName = r.packageName;
          diagnosisName = r.diagnosisName; schemeType = r.schemeType;
          payerName = r.payerName; requestedAmount = r.requestedAmount;
          status; updatedAt = Time.now(); submittedAt = r.submittedAt;
          expectedTATHours = r.expectedTATHours; remarks;
          queries = r.queries; documentChecklist = r.documentChecklist;
        };
        preAuths.put(id, updated);
        true;
      };
    };
  };

  public shared func addQueryResponse(id : Text, message : Text, fromTPA : Bool) : async Bool {
    switch (preAuths.get(id)) {
      case null { false };
      case (?r) {
        let newMsg : QueryMessage = { message; fromTPA; timestamp = Time.now() };
        let buf = Buffer.Buffer<QueryMessage>(r.queries.size() + 1);
        for (q in r.queries.vals()) { buf.add(q); };
        buf.add(newMsg);
        let newStatus = if (fromTPA and r.status == "Submitted") "QueryRaised" else r.status;
        let updated : PreAuthRecord = {
          id = r.id; patientId = r.patientId; patientName = r.patientName;
          packageCode = r.packageCode; packageName = r.packageName;
          diagnosisName = r.diagnosisName; schemeType = r.schemeType;
          payerName = r.payerName; requestedAmount = r.requestedAmount;
          status = newStatus; updatedAt = Time.now(); submittedAt = r.submittedAt;
          expectedTATHours = r.expectedTATHours; remarks = r.remarks;
          queries = Buffer.toArray(buf); documentChecklist = r.documentChecklist;
        };
        preAuths.put(id, updated);
        true;
      };
    };
  };

  public query func getPreAuthsByStatus(status : Text) : async [PreAuthRecord] {
    let buf = Buffer.Buffer<PreAuthRecord>(4);
    for ((_, r) in preAuths.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    Buffer.toArray(buf);
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

  stable var clinicalDocEntries : [(Text, ClinicalDocRecord)] = [];
  stable var nextClinicalDocId : Nat = 1;
  transient var clinicalDocs : HashMap.HashMap<Text, ClinicalDocRecord> =
    HashMap.fromIter<Text, ClinicalDocRecord>(clinicalDocEntries.vals(), 10, Text.equal, Text.hash);

  private func genClinicalDocId() : Text {
    let id = "CDOC-" # Nat.toText(nextClinicalDocId);
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
    clinicalDocs.put(id, record);
    #ok(id);
  };

  public query func getClinicalDocs() : async [ClinicalDocRecord] {
    Iter.toArray(clinicalDocs.vals());
  };

  public query func getClinicalDocById(id : Text) : async ?ClinicalDocRecord {
    clinicalDocs.get(id);
  };

  public query func getClinicalDocsByPatient(patientId : Text) : async [ClinicalDocRecord] {
    let buf = Buffer.Buffer<ClinicalDocRecord>(4);
    for ((_, r) in clinicalDocs.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    Buffer.toArray(buf);
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
        let updated : ClinicalDocRecord = {
          id = r.id;
          patientId = r.patientId;
          patientName = r.patientName;
          packageCodes = r.packageCodes;
          packageNames = r.packageNames;
          doctorNotes;
          dischargeSummary;
          documentChecklist;
          status;
          createdAt = r.createdAt;
          updatedAt = Time.now();
        };
        clinicalDocs.put(id, updated);
        true;
      };
    };
  };

  public query func getClinicalDocsByStatus(status : Text) : async [ClinicalDocRecord] {
    let buf = Buffer.Buffer<ClinicalDocRecord>(4);
    for ((_, r) in clinicalDocs.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  // ─────────────────────────────────────────────
  // Claims types
  // ─────────────────────────────────────────────

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

  stable var claimEntries : [(Text, ClaimRecord)] = [];
  stable var nextClaimId : Nat = 1;
  transient var claims : HashMap.HashMap<Text, ClaimRecord> =
    HashMap.fromIter<Text, ClaimRecord>(claimEntries.vals(), 10, Text.equal, Text.hash);

  private func genClaimId() : Text {
    let id = "CLM-" # Nat.toText(nextClaimId);
    nextClaimId += 1;
    id;
  };

  // ─────────────────────────────────────────────
  // Claims functions
  // ─────────────────────────────────────────────

  public shared func createClaim(req : ClaimRequest) : async ClaimResult {
    let id = genClaimId();
    let now = Time.now();
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
      createdAt = now;
      updatedAt = now;
    };
    claims.put(id, record);
    #ok(id);
  };

  public query func getClaims() : async [ClaimRecord] {
    Iter.toArray(claims.vals());
  };

  public query func getClaimById(id : Text) : async ?ClaimRecord {
    claims.get(id);
  };

  public query func getClaimsByPatient(patientId : Text) : async [ClaimRecord] {
    let buf = Buffer.Buffer<ClaimRecord>(4);
    for ((_, r) in claims.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  public query func getClaimsByPreAuth(preAuthId : Text) : async [ClaimRecord] {
    let buf = Buffer.Buffer<ClaimRecord>(4);
    for ((_, r) in claims.entries()) {
      if (r.preAuthId == preAuthId) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  public shared func updateClaimStatus(id : Text, status : Text, remarks : Text) : async Bool {
    switch (claims.get(id)) {
      case null { false };
      case (?r) {
        let settlementDate = if (status == "Settled") {
          Int.toText(Time.now());
        } else {
          r.settlementDate;
        };
        let updated : ClaimRecord = {
          id = r.id; patientId = r.patientId; patientName = r.patientName;
          preAuthId = r.preAuthId; packageCode = r.packageCode;
          packageName = r.packageName; diagnosisName = r.diagnosisName;
          schemeType = r.schemeType; payerName = r.payerName;
          admissionDate = r.admissionDate; dischargeDate = r.dischargeDate;
          billedAmount = r.billedAmount; approvedAmount = r.approvedAmount;
          icdCode = r.icdCode; procedureDetails = r.procedureDetails;
          claimType = r.claimType;
          status;
          rejectionRemarks = if (status == "Rejected") remarks else r.rejectionRemarks;
          settlementDate;
          documentChecklist = r.documentChecklist;
          createdAt = r.createdAt;
          updatedAt = Time.now();
        };
        claims.put(id, updated);
        true;
      };
    };
  };

  public query func getClaimsByStatus(status : Text) : async [ClaimRecord] {
    let buf = Buffer.Buffer<ClaimRecord>(4);
    for ((_, r) in claims.entries()) {
      if (r.status == status) { buf.add(r); };
    };
    Buffer.toArray(buf);
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

  stable var paymentEntries : [(Text, PaymentRecord)] = [];
  stable var nextPaymentId : Nat = 1;
  transient var payments : HashMap.HashMap<Text, PaymentRecord> =
    HashMap.fromIter<Text, PaymentRecord>(paymentEntries.vals(), 10, Text.equal, Text.hash);

  private func genPaymentId() : Text {
    let id = "PAY-" # Nat.toText(nextPaymentId);
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
    payments.put(id, record);
    #ok(id);
  };

  public query func getPayments() : async [PaymentRecord] {
    Iter.toArray(payments.vals());
  };

  public query func getPaymentById(id : Text) : async ?PaymentRecord {
    payments.get(id);
  };

  public query func getPaymentsByPatient(patientId : Text) : async [PaymentRecord] {
    let buf = Buffer.Buffer<PaymentRecord>(4);
    for ((_, r) in payments.entries()) {
      if (r.patientId == patientId) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  public query func getPaymentsByClaimId(claimId : Text) : async [PaymentRecord] {
    let buf = Buffer.Buffer<PaymentRecord>(4);
    for ((_, r) in payments.entries()) {
      if (r.claimId == claimId) { buf.add(r); };
    };
    Buffer.toArray(buf);
  };

  public query func getPaymentsByStatus(status : Text) : async [PaymentRecord] {
    let buf = Buffer.Buffer<PaymentRecord>(4);
    for ((_, r) in payments.entries()) {
      if (r.settlementStatus == status) { buf.add(r); };
    };
    Buffer.toArray(buf);
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
        let updated : PaymentRecord = {
          id = r.id;
          claimId = r.claimId;
          patientId = r.patientId;
          patientName = r.patientName;
          payerName = r.payerName;
          billedAmount = r.billedAmount;
          approvedAmount = r.approvedAmount;
          paidAmount;
          paymentMode = r.paymentMode;
          transactionRef;
          paymentDate = r.paymentDate;
          settlementStatus;
          discrepancyRemarks;
          reconciledAt = if (settlementStatus == "Paid") now else r.reconciledAt;
          createdAt = r.createdAt;
          updatedAt = now;
        };
        payments.put(id, updated);
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

  stable var hospitalEntries : [(Text, HospitalMaster)] = [];
  stable var nextHospitalId : Nat = 1;
  transient var hospitals : HashMap.HashMap<Text, HospitalMaster> =
    HashMap.fromIter<Text, HospitalMaster>(hospitalEntries.vals(), 10, Text.equal, Text.hash);

  public shared func createHospital(req : HospitalMasterRequest) : async MasterResult {
    for ((_, h) in hospitals.entries()) {
      if (toLower(h.code) == toLower(req.code)) {
        return #err("Hospital with this code already exists: " # h.id);
      };
    };
    let id = "HOSP-" # Nat.toText(nextHospitalId);
    nextHospitalId += 1;
    let now = Time.now();
    hospitals.put(id, {
      id; name = req.name; code = req.code; address = req.address;
      nabhNumber = req.nabhNumber; rohiniId = req.rohiniId;
      contactPerson = req.contactPerson; phone = req.phone;
      email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getHospitals() : async [HospitalMaster] {
    Iter.toArray(hospitals.vals());
  };

  public shared func updateHospital(id : Text, req : HospitalMasterRequest) : async Bool {
    switch (hospitals.get(id)) {
      case null { false };
      case (?h) {
        hospitals.put(id, {
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
      case (_) { hospitals.delete(id); true };
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

  stable var doctorEntries : [(Text, DoctorMaster)] = [];
  stable var nextDoctorId : Nat = 1;
  transient var doctors : HashMap.HashMap<Text, DoctorMaster> =
    HashMap.fromIter<Text, DoctorMaster>(doctorEntries.vals(), 10, Text.equal, Text.hash);

  public shared func createDoctor(req : DoctorMasterRequest) : async MasterResult {
    if (req.registrationNumber != "") {
      for ((_, d) in doctors.entries()) {
        if (toLower(d.registrationNumber) == toLower(req.registrationNumber)) {
          return #err("Doctor with this registration number already exists: " # d.id);
        };
      };
    };
    let id = "DOC-" # Nat.toText(nextDoctorId);
    nextDoctorId += 1;
    let now = Time.now();
    doctors.put(id, {
      id; name = req.name; registrationNumber = req.registrationNumber;
      specialisation = req.specialisation; department = req.department;
      phone = req.phone; email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getDoctors() : async [DoctorMaster] {
    Iter.toArray(doctors.vals());
  };

  public shared func updateDoctor(id : Text, req : DoctorMasterRequest) : async Bool {
    switch (doctors.get(id)) {
      case null { false };
      case (?d) {
        doctors.put(id, {
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
      case (_) { doctors.delete(id); true };
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

  stable var tpaEntries : [(Text, TpaMaster)] = [];
  stable var nextTpaId : Nat = 1;
  transient var tpas : HashMap.HashMap<Text, TpaMaster> =
    HashMap.fromIter<Text, TpaMaster>(tpaEntries.vals(), 10, Text.equal, Text.hash);

  public shared func createTpa(req : TpaMasterRequest) : async MasterResult {
    for ((_, t) in tpas.entries()) {
      if (toLower(t.code) == toLower(req.code)) {
        return #err("TPA with this code already exists: " # t.id);
      };
    };
    let id = "TPA-" # Nat.toText(nextTpaId);
    nextTpaId += 1;
    let now = Time.now();
    tpas.put(id, {
      id; name = req.name; code = req.code; tpaType = req.tpaType;
      contactPerson = req.contactPerson; phone = req.phone;
      email = req.email; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getTpas() : async [TpaMaster] {
    Iter.toArray(tpas.vals());
  };

  public shared func updateTpa(id : Text, req : TpaMasterRequest) : async Bool {
    switch (tpas.get(id)) {
      case null { false };
      case (?t) {
        tpas.put(id, {
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
      case (_) { tpas.delete(id); true };
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

  stable var icdEntries : [(Text, IcdMaster)] = [];
  stable var nextIcdId : Nat = 1;
  transient var icds : HashMap.HashMap<Text, IcdMaster> =
    HashMap.fromIter<Text, IcdMaster>(icdEntries.vals(), 10, Text.equal, Text.hash);

  public shared func createIcd(req : IcdMasterRequest) : async MasterResult {
    for ((_, i) in icds.entries()) {
      if (toLower(i.code) == toLower(req.code)) {
        return #err("ICD code already exists: " # i.id);
      };
    };
    let id = "ICD-" # Nat.toText(nextIcdId);
    nextIcdId += 1;
    let now = Time.now();
    icds.put(id, {
      id; code = req.code; description = req.description;
      category = req.category; isActive = req.isActive;
      createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getIcds() : async [IcdMaster] {
    Iter.toArray(icds.vals());
  };

  public shared func updateIcd(id : Text, req : IcdMasterRequest) : async Bool {
    switch (icds.get(id)) {
      case null { false };
      case (?i) {
        icds.put(id, {
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
      case (_) { icds.delete(id); true };
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

  stable var wardEntries : [(Text, WardMaster)] = [];
  stable var nextWardId : Nat = 1;
  transient var wards : HashMap.HashMap<Text, WardMaster> =
    HashMap.fromIter<Text, WardMaster>(wardEntries.vals(), 10, Text.equal, Text.hash);

  public shared func createWard(req : WardMasterRequest) : async MasterResult {
    let id = "WARD-" # Nat.toText(nextWardId);
    nextWardId += 1;
    let now = Time.now();
    wards.put(id, {
      id; name = req.name; wardType = req.wardType;
      ratePerDay = req.ratePerDay; totalBeds = req.totalBeds;
      isActive = req.isActive; createdAt = now; updatedAt = now
    });
    #ok(id);
  };

  public query func getWards() : async [WardMaster] {
    Iter.toArray(wards.vals());
  };

  public shared func updateWard(id : Text, req : WardMasterRequest) : async Bool {
    switch (wards.get(id)) {
      case null { false };
      case (?w) {
        wards.put(id, {
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
      case (_) { wards.delete(id); true };
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

  stable var denialEntries : [(Text, DenialRecord)] = [];
  stable var nextDenialId : Nat = 1;
  transient var denials : HashMap.HashMap<Text, DenialRecord> =
    HashMap.fromIter<Text, DenialRecord>(denialEntries.vals(), 10, Text.equal, Text.hash);

  private func genDenialId() : Text {
    let id = "DNL-" # Nat.toText(nextDenialId);
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
    denials.put(id, {
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
    Iter.toArray(denials.vals());
  };

  public query func getDenialById(id : Text) : async ?DenialRecord {
    denials.get(id);
  };

  public query func getDenialsByClaimId(claimId : Text) : async [DenialRecord] {
    Array.filter<DenialRecord>(
      Iter.toArray(denials.vals()),
      func(d) { d.claimId == claimId }
    );
  };

  public query func getDenialsByStatus(status : Text) : async [DenialRecord] {
    Array.filter<DenialRecord>(
      Iter.toArray(denials.vals()),
      func(d) { toLower(d.status) == toLower(status) }
    );
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
        denials.put(id, {
          id = d.id; claimId = d.claimId; patientId = d.patientId;
          patientName = d.patientName; payerName = d.payerName;
          schemeType = d.schemeType; packageCode = d.packageCode;
          packageName = d.packageName; rejectionRemarks = d.rejectionRemarks;
          rejectionCategory = d.rejectionCategory;
          rootCauseNotes = if (rootCauseNotes == "") d.rootCauseNotes else rootCauseNotes;
          alertSent = true;
          resubmittedAt = if (resubmitted) now else d.resubmittedAt;
          resolvedAt = if (status == "Resolved" or status == "WrittenOff") now else d.resolvedAt;
          status; createdAt = d.createdAt; updatedAt = now
        });
        true;
      };
    };
  };

  // ─────────────────────────────────────────────
  // Upgrade hooks
  // ─────────────────────────────────────────────

  system func preupgrade() {
    patientEntries := Iter.toArray(patients.entries());
    preAuthEntries := Iter.toArray(preAuths.entries());
    clinicalDocEntries := Iter.toArray(clinicalDocs.entries());
    claimEntries := Iter.toArray(claims.entries());
    paymentEntries := Iter.toArray(payments.entries());
    hospitalEntries := Iter.toArray(hospitals.entries());
    doctorEntries := Iter.toArray(doctors.entries());
    tpaEntries := Iter.toArray(tpas.entries());
    icdEntries := Iter.toArray(icds.entries());
    wardEntries := Iter.toArray(wards.entries());
    denialEntries := Iter.toArray(denials.entries());
  };

  system func postupgrade() {
    patients := HashMap.fromIter<Text, Patient>(patientEntries.vals(), 10, Text.equal, Text.hash);
    patientEntries := [];
    preAuths := HashMap.fromIter<Text, PreAuthRecord>(preAuthEntries.vals(), 10, Text.equal, Text.hash);
    preAuthEntries := [];
    clinicalDocs := HashMap.fromIter<Text, ClinicalDocRecord>(clinicalDocEntries.vals(), 10, Text.equal, Text.hash);
    clinicalDocEntries := [];
    claims := HashMap.fromIter<Text, ClaimRecord>(claimEntries.vals(), 10, Text.equal, Text.hash);
    claimEntries := [];
    payments := HashMap.fromIter<Text, PaymentRecord>(paymentEntries.vals(), 10, Text.equal, Text.hash);
    paymentEntries := [];
    hospitals := HashMap.fromIter<Text, HospitalMaster>(hospitalEntries.vals(), 10, Text.equal, Text.hash);
    hospitalEntries := [];
    doctors := HashMap.fromIter<Text, DoctorMaster>(doctorEntries.vals(), 10, Text.equal, Text.hash);
    doctorEntries := [];
    tpas := HashMap.fromIter<Text, TpaMaster>(tpaEntries.vals(), 10, Text.equal, Text.hash);
    tpaEntries := [];
    icds := HashMap.fromIter<Text, IcdMaster>(icdEntries.vals(), 10, Text.equal, Text.hash);
    icdEntries := [];
    wards := HashMap.fromIter<Text, WardMaster>(wardEntries.vals(), 10, Text.equal, Text.hash);
    wardEntries := [];
    denials := HashMap.fromIter<Text, DenialRecord>(denialEntries.vals(), 10, Text.equal, Text.hash);
    denialEntries := [];
  };
};
