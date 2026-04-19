import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";

import { api } from "../../api/client";
import type { CaseDocument, SampleDocument } from "../../lib/types";
import { DOC_TYPES } from "../../lib/types";

function prettySize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} KB`;
  return `${n} B`;
}

const DOC_TYPE_META: Record<string, { label: string; hex: string }> = {
  cibil: { label: "CIBIL", hex: "#818cf8" },
  bank_statement: { label: "Bank Statement", hex: "#34d399" },
  gst_certificate: { label: "GST Cert", hex: "#38bdf8" },
  gstin_filings: { label: "GSTIN Filings", hex: "#22d3ee" },
  bank_ac_auth: { label: "A/C Aggregator", hex: "#a78bfa" },
  itr: { label: "ITR", hex: "#fbbf24" },
  ledger: { label: "Ledger", hex: "#fb7185" },
  other: { label: "Other", hex: "#cbd5e1" },
};

export function DocumentUploader({
  caseId,
  documents,
  onChange,
}: {
  caseId: string | null;
  documents: CaseDocument[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const samplesQuery = useQuery<SampleDocument[]>({
    queryKey: ["samples"],
    queryFn: () => api.listSamples(),
  });

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!caseId) {
        setError("Create the case first — then upload documents.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          await api.uploadDocument(caseId, file);
        }
        onChange();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [caseId, onChange],
  );

  const onPick = () => inputRef.current?.click();

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) uploadFiles(files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropping(false);
    if (!e.dataTransfer?.files) return;
    uploadFiles(e.dataTransfer.files);
  };

  const attachSample = async (s: SampleDocument) => {
    if (!caseId) {
      setError("Create the case first — then attach samples.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.attachSample(caseId, s.filename);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: CaseDocument) => {
    if (!caseId) return;
    await api.deleteDocument(caseId, doc.id);
    onChange();
  };

  const reclassify = async (doc: CaseDocument, newType: string) => {
    if (!caseId) return;
    await api.updateDocumentType(caseId, doc.id, newType);
    setEditingDoc(null);
    onChange();
  };

  const samples = samplesQuery.data || [];
  const usedFilenames = new Set(documents.map((d) => d.original_filename));

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Evidence</div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            Upload documents
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/30 font-medium normal-case tracking-normal">
              <Wand2 className="w-3 h-3" /> auto-identified
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowSamples((s) => !s)}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> {showSamples ? "Hide" : "Browse"} samples ({samples.length})
        </button>
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
        onClick={onPick}
        animate={{
          scale: dropping ? 1.01 : 1,
          borderColor: dropping ? "rgba(129,140,248,.5)" : "rgba(255,255,255,.1)",
        }}
        className={`cursor-pointer rounded-2xl ring-1 p-8 flex flex-col items-center justify-center text-center transition-colors ${
          dropping ? "bg-indigo-500/10 ring-indigo-400/40" : "bg-slate-900/[0.025] dark:bg-white/[0.03] ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]"
        } ${!caseId ? "opacity-60 pointer-events-none" : ""}`}
      >
        <motion.div
          animate={{ y: dropping ? -4 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20 ring-1 ring-slate-900/10 dark:ring-white/15 grid place-items-center mb-3"
        >
          <Upload className="w-6 h-6 text-indigo-200" />
        </motion.div>
        <div className="text-sm font-medium">
          {dropping ? "Release to upload" : "Drag 5-6 documents here, or click to select"}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          CIBIL · Bank Statement · GST · ITR · Ledger · Account Aggregator · PDF / XLSX / CSV / JSON
        </div>
        <input ref={inputRef} type="file" multiple onChange={onFileInput} className="hidden" />
      </motion.div>

      {busy && <div className="mt-3 text-[11px] text-indigo-200 flex items-center gap-1.5"><Wand2 className="w-3 h-3 animate-pulse" /> Identifying documents…</div>}
      {!caseId && (
        <div className="mt-3 text-[11px] text-amber-300">
          Create the case first — uploads attach after creation.
        </div>
      )}
      {error && <div className="mt-3 text-[11px] text-rose-300">{error}</div>}

      <AnimatePresence initial={false}>
        {showSamples && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.02] dark:bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                Sample library (backend/docs) — one click to attach
              </div>
              <div className="grid grid-cols-2 gap-2">
                {samples.map((s) => {
                  const used = usedFilenames.has(s.filename);
                  const meta = DOC_TYPE_META[s.doc_type] || DOC_TYPE_META.other;
                  return (
                    <motion.button
                      key={s.filename}
                      type="button"
                      layout
                      whileHover={{ x: 2 }}
                      disabled={used || !caseId || busy}
                      onClick={() => attachSample(s)}
                      className={`text-left rounded-lg px-3 py-2 ring-1 flex items-center gap-3 transition-colors ${
                        used
                          ? "bg-emerald-500/10 ring-emerald-400/30"
                          : "bg-slate-900/[0.025] dark:bg-white/[0.03] ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]"
                      } disabled:cursor-not-allowed`}
                    >
                      <div
                        className="w-8 h-8 rounded-md grid place-items-center shrink-0"
                        style={{ background: `${meta.hex}22`, color: meta.hex }}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{s.filename}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {meta.label} · {prettySize(s.size_bytes)}
                        </div>
                      </div>
                      {used ? <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                    </motion.button>
                  );
                })}
                {!samplesQuery.isLoading && samples.length === 0 && (
                  <div className="col-span-2 text-xs text-slate-500 dark:text-slate-400 text-center py-4">No sample documents found.</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {documents.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Attached ({documents.length})</div>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {documents.map((doc) => {
                const meta = DOC_TYPE_META[doc.doc_type] || DOC_TYPE_META.other;
                const conf = doc.identify?.confidence ?? 0;
                const identSource = doc.identify?.source || "";
                const identBand =
                  conf >= 0.85 ? { label: "high", color: "text-emerald-300" }
                    : conf >= 0.55 ? { label: "ok", color: "text-amber-300" }
                      : { label: "low", color: "text-rose-300" };
                return (
                  <motion.li
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="rounded-lg bg-slate-900/[0.025] dark:bg-white/[0.03] ring-1 ring-slate-900/10 dark:ring-white/10 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        className="w-10 h-10 rounded-md grid place-items-center shrink-0"
                        style={{ background: `${meta.hex}22`, color: meta.hex }}
                        initial={{ scale: 0.7, rotate: -6 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      >
                        <FileText className="w-5 h-5" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {doc.original_filename}
                        </a>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {/* Auto-identified badge */}
                          <motion.button
                            type="button"
                            layout
                            onClick={() => setEditingDoc(editingDoc === doc.id ? null : doc.id)}
                            whileHover={{ y: -1 }}
                            className="text-[11px] px-2 py-0.5 rounded-full ring-1 inline-flex items-center gap-1 font-medium"
                            style={{ background: `${meta.hex}22`, color: meta.hex, borderColor: `${meta.hex}55` }}
                          >
                            <Wand2 className="w-3 h-3" /> {meta.label}
                          </motion.button>
                          {identSource && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              via {identSource} · <span className={identBand.color}>{Math.round(conf * 100)}% {identBand.label}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">· {prettySize(doc.size_bytes)} · {doc.source}</span>
                        </div>
                        {doc.identify?.evidence && doc.identify.source.includes("content") && (
                          <div className="mt-1.5 text-[10px] text-slate-500 italic line-clamp-1">“{doc.identify.evidence}”</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(doc)}
                        className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {editingDoc === doc.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pl-13 flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 self-center mr-1">Override →</span>
                            {DOC_TYPES.map((t) => {
                              const active = doc.doc_type === t.value;
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  disabled={active}
                                  onClick={() => reclassify(doc, t.value)}
                                  className={`text-[10px] px-2 py-0.5 rounded-full ring-1 transition-colors ${
                                    active
                                      ? "bg-white text-slate-900 ring-white cursor-default"
                                      : "bg-slate-900/[0.05] dark:bg-white/5 ring-slate-900/10 dark:ring-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
                                  }`}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
