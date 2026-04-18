import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCcw, Sparkles } from "lucide-react";

import { api } from "../api/client";
import { DocumentUploader } from "../components/intake/DocumentUploader";

function newExternalId(): string {
  return `CRP-${Math.floor(Math.random() * 89999 + 10000)}`;
}

// Minimal payload — everything else is populated by the document extractors
// as the user uploads real CIBIL / bank statement / GST / ITR files.
const minimalPayload = (externalId: string, applicantName: string) => ({
  external_id: externalId,
  applicant_name: applicantName || "Pending applicant",
});

export function CaseIntakePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [externalId, setExternalId] = useState(newExternalId);
  const [applicantName, setApplicantName] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createCase(minimalPayload(externalId, applicantName)),
    onSuccess: (c) => {
      setCreatedId(c.id);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  const caseDetail = useQuery({
    queryKey: ["case", createdId],
    queryFn: () => api.getCase(createdId!),
    enabled: !!createdId,
  });

  const resetForm = () => {
    setExternalId(newExternalId());
    setApplicantName("");
    setCreatedId(null);
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="px-6 pt-10 pb-12 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">New application</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create an application, attach evidence.
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            The expert panel reads whatever you attach — CIBIL, bank statement, GST filings, AA account authentication. Application ID is generated automatically.
          </p>
        </motion.div>

        {/* Minimal card: auto ID + applicant name */}
        <motion.section
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-6"
        >
          <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
            {/* Auto application ID */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Application ID</div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2.5 rounded-lg bg-slate-950/60 ring-1 ring-white/10 font-mono text-sm tabular-nums min-w-[140px]">
                  {externalId}
                </div>
                <button
                  type="button"
                  disabled={!!createdId}
                  onClick={() => setExternalId(newExternalId())}
                  title="Regenerate"
                  className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 text-slate-300 disabled:opacity-40"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Applicant name */}
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Applicant name</div>
              <input
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                disabled={!!createdId}
                placeholder="e.g. Rakesh Traders Pvt Ltd"
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950/60 ring-1 ring-white/10 text-sm focus:outline-none focus:ring-indigo-400/50 disabled:opacity-70"
              />
            </label>
          </div>

          {!createdId ? (
            <motion.div layout className="mt-5 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Structured fields stay empty. The expert panel reads your attached documents to form a view.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => nav("/queue")}
                  className="px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 text-sm"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!applicantName.trim() || create.isPending}
                  onClick={() => create.mutate()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {create.isPending ? "Creating…" : "Create application"}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              layout
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="mt-5 rounded-xl ring-1 ring-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 flex items-center justify-between gap-3"
            >
              <div>
                Application <b className="font-mono">{externalId}</b> created.
                Attach documents below, then run the expert panel.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-emerald-50 text-xs hover:bg-white/20"
                >
                  New case
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => nav(`/cases/${createdId}`)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400 text-emerald-950 text-xs font-semibold flex items-center gap-1"
                >
                  Open theatre <ArrowRight className="w-3 h-3" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {create.error && <div className="mt-3 text-xs text-rose-300">Error: {(create.error as Error).message}</div>}
        </motion.section>

        <DocumentUploader
          caseId={createdId}
          documents={caseDetail.data?.documents || []}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["case", createdId] });
          }}
        />
      </div>
    </div>
  );
}
