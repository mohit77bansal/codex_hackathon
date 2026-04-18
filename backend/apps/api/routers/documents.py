"""Document upload + sample library endpoints."""
from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID

from django.conf import settings
from django.core.files import File as DjangoFile
from django.shortcuts import get_object_or_404
from ninja import File, Form, Router
from ninja.files import UploadedFile

from apps.agents.doc_extract_llm import extract_and_apply
from apps.agents.doc_identify import identify as identify_document
from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import Case, CaseDocument, DocumentType

router = Router(tags=["documents"])
samples_router = Router(tags=["samples"])


DOC_TYPE_HINTS: list[tuple[str, str]] = [
    ("cibil", DocumentType.CIBIL),
    ("bank-statement", DocumentType.BANK_STATEMENT),
    ("bank_statement", DocumentType.BANK_STATEMENT),
    ("gst_certificate", DocumentType.GST_CERTIFICATE),
    ("gst-certificate", DocumentType.GST_CERTIFICATE),
    ("gstin", DocumentType.GSTIN_FILINGS),
    ("ledger", DocumentType.LEDGER),
    ("itr", DocumentType.ITR),
    ("aa", DocumentType.BANK_AC_AUTH),
]


def _infer_doc_type(name: str) -> str:
    lowered = name.lower()
    for needle, kind in DOC_TYPE_HINTS:
        if needle in lowered:
            return kind
    return DocumentType.OTHER


def _serialize(doc: CaseDocument) -> dict[str, Any]:
    meta = doc.extracted_meta or {}
    return {
        "id": str(doc.id),
        "doc_type": doc.doc_type,
        "doc_type_display": doc.get_doc_type_display(),
        "original_filename": doc.original_filename,
        "size_bytes": doc.size_bytes,
        "mime_type": doc.mime_type,
        "source": doc.source,
        "url": doc.file.url if doc.file else "",
        "uploaded_at": doc.uploaded_at.isoformat(),
        "identify": {
            "confidence": meta.get("identify_confidence", 0.0),
            "source": meta.get("identify_source", ""),
            "evidence": meta.get("identify_evidence", ""),
        },
        "extracted": meta.get("extracted", {}),
    }


@router.get("/{case_id}/documents/")
def list_documents(request, case_id: UUID):
    case = get_object_or_404(Case, id=case_id)
    return [_serialize(d) for d in case.documents.all()]


@router.post("/{case_id}/documents/upload/")
def upload_document(
    request,
    case_id: UUID,
    file: UploadedFile = File(...),
    doc_type: str = Form(""),
):
    """Upload a document. Backend auto-identifies the type from filename + content."""
    case = get_object_or_404(Case, id=case_id)
    mime = getattr(file, "content_type", None) or mimetypes.guess_type(file.name)[0] or "application/octet-stream"

    # Persist first so we can peek at the file from disk
    doc = CaseDocument.objects.create(
        case=case,
        doc_type=DocumentType.OTHER,
        original_filename=file.name,
        file=file,
        size_bytes=getattr(file, "size", 0),
        mime_type=mime,
        source="upload",
    )

    try:
        ident = identify_document(Path(doc.file.path), filename=file.name)
    except Exception:  # noqa: BLE001
        ident = {"doc_type": _infer_doc_type(file.name), "confidence": 0.5, "source": "filename", "evidence": file.name}

    # Respect user override if they passed a valid doc_type, else trust auto-id
    chosen = doc_type if doc_type in DocumentType.values else ident["doc_type"]
    doc.doc_type = chosen
    doc.extracted_meta = {
        "identify_confidence": ident["confidence"],
        "identify_source": ident["source"],
        "identify_evidence": ident["evidence"],
        "auto_identified_as": ident["doc_type"],
    }
    doc.save(update_fields=["doc_type", "extracted_meta"])

    extracted = extract_and_apply(doc)

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.CASE_CREATED,
        actor="user:intake",
        title=f"Document uploaded · {doc.get_doc_type_display()}",
        body=f"{file.name} · identified as {chosen} ({ident['confidence']:.0%} via {ident['source']})"
             + (f" · extracted {list(extracted.keys())}" if extracted else ""),
        payload={"doc_id": str(doc.id), "doc_type": chosen, "source": "upload", "identify": ident, "extracted": extracted},
    )
    return _serialize(doc)


@router.post("/{case_id}/documents/attach-sample/")
def attach_sample(request, case_id: UUID, filename: str = Form(...), doc_type: str = Form("")):
    case = get_object_or_404(Case, id=case_id)
    sample_dir = Path(settings.SAMPLE_DOCS_DIR)
    src = sample_dir / filename
    if not src.exists() or not src.is_file() or src.parent.resolve() != sample_dir.resolve():
        return {"error": "file not found"}  # type: ignore[return-value]

    try:
        ident = identify_document(src, filename=filename)
    except Exception:  # noqa: BLE001
        ident = {"doc_type": _infer_doc_type(filename), "confidence": 0.5, "source": "filename", "evidence": filename}

    chosen = doc_type if doc_type in DocumentType.values else ident["doc_type"]
    mime = mimetypes.guess_type(str(src))[0] or "application/octet-stream"

    with src.open("rb") as fh:
        doc = CaseDocument(
            case=case,
            doc_type=chosen,
            original_filename=src.name,
            size_bytes=src.stat().st_size,
            mime_type=mime,
            source="sample",
            extracted_meta={
                "identify_confidence": ident["confidence"],
                "identify_source": ident["source"],
                "identify_evidence": ident["evidence"],
                "auto_identified_as": ident["doc_type"],
            },
        )
        doc.file.save(src.name, DjangoFile(fh), save=True)

    extracted = extract_and_apply(doc)

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.CASE_CREATED,
        actor="user:intake",
        title=f"Sample attached · {doc.get_doc_type_display()}",
        body=f"{src.name} · identified as {chosen} ({ident['confidence']:.0%} via {ident['source']})"
             + (f" · extracted {list(extracted.keys())}" if extracted else ""),
        payload={"doc_id": str(doc.id), "doc_type": chosen, "source": "sample", "identify": ident, "extracted": extracted},
    )
    return _serialize(doc)


@router.post("/{case_id}/documents/reextract/")
def reextract_all(request, case_id: UUID):
    """Re-run extraction against every document attached to this case.

    Useful when you've upgraded extractors or switched from regex to LLM —
    you don't have to re-upload the files.
    """
    case = get_object_or_404(Case, id=case_id)
    out: list[dict[str, Any]] = []
    for doc in case.documents.all():
        extracted = extract_and_apply(doc)
        out.append({
            "doc_id": str(doc.id),
            "doc_type": doc.doc_type,
            "filename": doc.original_filename,
            "extracted": extracted,
        })
        AuditLogService.append(
            case=case,
            event_type=AuditEventType.CASE_CREATED,
            actor="system",
            title=f"Re-extracted · {doc.get_doc_type_display()}",
            body=f"{doc.original_filename} · fields {list(extracted.keys())}",
            payload={"doc_id": str(doc.id), "extracted": extracted},
        )
    return {"count": len(out), "results": out}


@router.patch("/{case_id}/documents/{doc_id}/")
def update_document_type(request, case_id: UUID, doc_id: UUID, doc_type: str = Form(...)):
    doc = get_object_or_404(CaseDocument, id=doc_id, case_id=case_id)
    if doc_type not in DocumentType.values:
        return {"error": "invalid doc_type"}  # type: ignore[return-value]
    old = doc.doc_type
    doc.doc_type = doc_type
    meta = doc.extracted_meta or {}
    meta["manual_override_from"] = old
    doc.extracted_meta = meta
    doc.save(update_fields=["doc_type", "extracted_meta"])

    AuditLogService.append(
        case=doc.case,
        event_type=AuditEventType.CASE_CREATED,
        actor="user:intake",
        title=f"Document re-classified · {doc.get_doc_type_display()}",
        body=f"{doc.original_filename}: {old} → {doc_type}",
        payload={"doc_id": str(doc.id), "from": old, "to": doc_type},
    )
    return _serialize(doc)


@router.delete("/{case_id}/documents/{doc_id}/")
def delete_document(request, case_id: UUID, doc_id: UUID):
    doc = get_object_or_404(CaseDocument, id=doc_id, case_id=case_id)
    if doc.file:
        try:
            doc.file.delete(save=False)
        except OSError:
            pass
    doc.delete()
    return {"success": True}


@samples_router.get("/")
def list_samples(request):
    sample_dir = Path(settings.SAMPLE_DOCS_DIR)
    if not sample_dir.exists():
        return []
    out: list[dict[str, Any]] = []
    for path in sorted(sample_dir.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        out.append({
            "filename": path.name,
            "size_bytes": path.stat().st_size,
            "mime_type": mimetypes.guess_type(str(path))[0] or "application/octet-stream",
            "doc_type": _infer_doc_type(path.name),
        })
    return out
