import type {
  AuditLedger,
  CaseDetail,
  CaseDocument,
  CaseListItem,
  FinalDecision,
  SampleDocument,
} from "../lib/types";

const BASE = import.meta.env.VITE_API_BASE || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCases: () => request<CaseListItem[]>("/cases/"),
  getCase: (id: string) => request<CaseDetail>(`/cases/${id}/`),
  createCase: (payload: Record<string, unknown>) =>
    request<CaseDetail>("/cases/", { method: "POST", body: JSON.stringify(payload) }),
  runCase: (id: string) =>
    request<{ case_id: string; status: string; stream_url: string }>(`/cases/${id}/run/`, {
      method: "POST",
    }),
  overrideCase: (id: string, verdict: string, note: string, user = "reviewer") =>
    request<FinalDecision>(`/cases/${id}/override/`, {
      method: "POST",
      body: JSON.stringify({ verdict, note, user }),
    }),
  getAudit: (id: string) => request<AuditLedger>(`/cases/${id}/audit/`),
  seedCases: (count = 8) =>
    request<CaseListItem[]>("/cases/seed", { method: "POST", body: JSON.stringify({ count }) }),
  deleteCase: (id: string) => request<{ success: boolean }>(`/cases/${id}/`, { method: "DELETE" }),
  purgeAllCases: () => request<{ success: boolean; message: string }>("/cases/", { method: "DELETE" }),
  reextractDocuments: (caseId: string) =>
    request<{ count: number; results: { doc_id: string; doc_type: string; filename: string; extracted: Record<string, unknown> }[] }>(
      `/cases/${caseId}/documents/reextract/`,
      { method: "POST" },
    ),
  listSamples: () => request<SampleDocument[]>("/samples/"),
  listDocuments: (caseId: string) => request<CaseDocument[]>(`/cases/${caseId}/documents/`),
  uploadDocument: async (caseId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`${BASE}/cases/${caseId}/documents/upload/`, { method: "POST", body });
    if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
    return (await res.json()) as CaseDocument;
  },
  attachSample: async (caseId: string, filename: string) => {
    const body = new FormData();
    body.append("filename", filename);
    const res = await fetch(`${BASE}/cases/${caseId}/documents/attach-sample/`, { method: "POST", body });
    if (!res.ok) throw new Error(`attach ${res.status}: ${await res.text()}`);
    return (await res.json()) as CaseDocument;
  },
  updateDocumentType: async (caseId: string, docId: string, docType: string) => {
    const body = new FormData();
    body.append("doc_type", docType);
    const res = await fetch(`${BASE}/cases/${caseId}/documents/${docId}/`, { method: "PATCH", body });
    if (!res.ok) throw new Error(`patch ${res.status}: ${await res.text()}`);
    return (await res.json()) as CaseDocument;
  },
  deleteDocument: (caseId: string, docId: string) =>
    request<{ success: boolean }>(`/cases/${caseId}/documents/${docId}/`, { method: "DELETE" }),
};
