export type Stance = "approve" | "reject" | "conditional" | "review";
export type Verdict = "approve" | "reject" | "conditional" | "escalate";
export type AgentKey = "bureau" | "bank" | "fraud" | "income" | "policy" | "behaviour" | "lead" | "governor";

export interface Flag {
  severity: "low" | "medium" | "high";
  code: string;
  message: string;
}

export interface Position {
  agent_key: AgentKey;
  display_name: string;
  stance: Stance;
  confidence: number;
  score: number;
  rationale: string;
  flags: Flag[];
  key_metrics: Record<string, string | number | boolean>;
  dissent_signal: { disagrees?: boolean; strength?: number; topic?: string };
  evidence_refs: string[];
  latency_ms: number | null;
}

export interface Debate {
  has_conflict: boolean;
  conflict_pairs: [string, string, number, string][];
  unique_topics: string[];
}

export interface Lead {
  reframed_question: string;
  proposed_structure: string;
  conditions: string[];
  residual_risks: string[];
  escalation_required: boolean;
  meters: Record<string, number>;
}

export interface FinalDecision {
  id: string;
  verdict: Verdict;
  chip_label: string;
  rationale: string;
  confidence: number;
  constraint_fit: string;
  audit_strength: string;
  conditions: string[];
  review_checkpoints: string[];
  created_at: string;
  override_by_user: string;
  override_note: string;
}

export interface CaseListItem {
  id: string;
  external_id: string;
  applicant_name: string;
  loan_type: string;
  amount_inr: number;
  sector: string;
  state: string;
  vintage_years: number;
  status: string;
  risk_band: "low" | "medium" | "high";
  verdict: string;
  consensus_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CaseDocument {
  id: string;
  doc_type: string;
  doc_type_display: string;
  original_filename: string;
  size_bytes: number;
  mime_type: string;
  source: "upload" | "sample";
  url: string;
  uploaded_at: string;
  identify?: {
    confidence: number;
    source: string;
    evidence: string;
  };
}

export interface SampleDocument {
  filename: string;
  size_bytes: number;
  mime_type: string;
  doc_type: string;
}

export const DOC_TYPES: { value: string; label: string; accept?: string }[] = [
  { value: "cibil", label: "CIBIL Report", accept: ".pdf" },
  { value: "bank_statement", label: "Bank Statement", accept: ".pdf,.csv,.xlsx" },
  { value: "gst_certificate", label: "GST Certificate", accept: ".pdf" },
  { value: "gstin_filings", label: "GSTIN Filings", accept: ".pdf,.json,.xlsx" },
  { value: "bank_ac_auth", label: "Bank A/C Auth", accept: ".pdf" },
  { value: "itr", label: "ITR", accept: ".pdf" },
  { value: "ledger", label: "Ledger", accept: ".pdf,.csv,.xlsx" },
  { value: "other", label: "Other", accept: "*" },
];

export interface CaseDetail extends CaseListItem {
  applicant: {
    legal_name: string;
    gstin: string;
    pan: string;
    industry: string;
    geography: string;
    vintage_months: number;
  } | null;
  financial: {
    monthly_revenue: number[];
    monthly_inflow: number[];
    monthly_outflow: number[];
    existing_emi: number;
    bounces_last_6mo: number;
    avg_monthly_balance: number;
    dscr: number;
    leverage: number;
  } | null;
  bureau: {
    cibil_score: number;
    dpd_buckets: Record<string, number>;
    enquiries_last_6mo: number;
    active_loans_count: number;
    utilization_pct: number;
    trade_lines: Record<string, unknown>[];
  } | null;
  kyc: {
    kyc_match_pct: number;
    pan_gst_linked: boolean;
    device_blocklist_hit: boolean;
    velocity_anomalies: number;
    document_authenticity_score: number;
  } | null;
  income: {
    itr_gross_income: number;
    itr_prior_year: number;
    gst_filings_regular: boolean;
    top_3_buyer_concentration_pct: number;
    anchor_name: string;
  } | null;
  behaviour: {
    prior_loans_count: number;
    historical_repayment_pct: number;
    avg_tenure_completion_pct: number;
    prepayments_count: number;
    rollover_frequency: number;
  } | null;
  positions: Position[];
  debate: Debate | null;
  lead: Lead | null;
  final_decision: FinalDecision | null;
  final_decision_history: FinalDecision[];
  documents: CaseDocument[];
}

export interface AuditEntry {
  id: string;
  sequence: number;
  timestamp: string;
  event_type: string;
  actor: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  row_hash: string;
}

export interface AuditLedger {
  case_id: string;
  entries: AuditEntry[];
  chain_valid: boolean;
  broken_sequences: number[];
}

export const AGENT_META: Record<
  AgentKey,
  { name: string; short: string; color: string }
> = {
  bureau: { name: "Bureau Score", short: "CIBIL & credit history", color: "indigo" },
  bank: { name: "Bank Statement", short: "Cash flow & banking", color: "emerald" },
  fraud: { name: "Fraud Detection", short: "KYC, device, velocity", color: "rose" },
  income: { name: "Income Verification", short: "ITR, GST, invoices", color: "amber" },
  policy: { name: "Policy", short: "RBI & internal policy", color: "sky" },
  behaviour: { name: "Behavioural", short: "Repayment & tenure", color: "fuchsia" },
  lead: { name: "Lead Reviewer", short: "Reframes the tradeoff", color: "violet" },
  governor: { name: "Final Governor", short: "Accountable decider", color: "cyan" },
};
