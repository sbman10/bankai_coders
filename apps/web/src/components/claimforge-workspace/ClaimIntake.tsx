"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, Sparkles, Upload } from "lucide-react";
import type { ClaimIntakePayload } from "./types";

export function ClaimIntake({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (claim: ClaimIntakePayload, idempotencyKey: string) => Promise<void> }) {
  const [product, setProduct] = useState("");
  const [fault, setFault] = useState("");
  const [failureDate, setFailureDate] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [warranty, setWarranty] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());

  function rotateIdempotencyKey() {
    idempotencyKey.current = crypto.randomUUID();
  }

  function acceptFile(file: File | null, save: (file: File | null) => void) {
    if (!file) {
      rotateIdempotencyKey();
      save(null);
      return true;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setUploadError("Choose a PDF, JPG, or PNG document.");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Each document must be 10 MB or smaller.");
      return false;
    }
    setUploadError("");
    rotateIdempotencyKey();
    save(file);
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit({ product, fault, failureDate, invoice, warranty }, idempotencyKey.current);
      idempotencyKey.current = crypto.randomUUID();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Claim intake failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content subpage-content">
      <button className="back-link" onClick={onCancel}><ArrowLeft size={15} /> Back to overview</button>
      <div className="form-heading"><div className="eyebrow"><span className="eyebrow-line" /> START WITH THE BASICS</div><h1>Let’s get your claim<br /> in order.</h1><p>Tell us what happened and add the documents you have. You’ll review everything before any next step.</p></div>
      <form className="intake-form" onSubmit={handleSubmit}>
        <div className="form-section-title"><span>01</span><div><h2>About the product</h2><p>A few details help us organize the right evidence.</p></div></div>
        <label className="field-label" htmlFor="product-name">Product name</label>
        <input id="product-name" className="text-input" required value={product} onChange={(event) => { rotateIdempotencyKey(); setProduct(event.target.value); }} placeholder="e.g. Wireless headphones" />
        <label className="field-label" htmlFor="fault-description">What went wrong?</label>
        <textarea id="fault-description" className="text-input textarea" required value={fault} onChange={(event) => { rotateIdempotencyKey(); setFault(event.target.value); }} placeholder="Describe the issue in your own words" rows={3} />
        <label className="field-label" htmlFor="failure-date">When did the issue begin? <span className="optional-label">OPTIONAL</span></label>
        <input id="failure-date" className="text-input" type="date" value={failureDate} onChange={(event) => { rotateIdempotencyKey(); setFailureDate(event.target.value); }} />

        <div className="form-section-title documents-title"><span>02</span><div><h2>Preview supporting paperwork</h2><p>PDF, JPG, or PNG · files are not uploaded.</p></div></div>
        <div className="upload-grid">
          <UploadField id="invoice-upload" label="Purchase invoice" file={invoice} onFile={(file) => acceptFile(file, setInvoice)} />
          <UploadField id="warranty-upload" label="Warranty terms" file={warranty} onFile={(file) => acceptFile(file, setWarranty)} />
        </div>
        {uploadError && <p role="alert" className="upload-error">{uploadError}</p>}
        <div className="form-safe-note"><LockKeyhole size={15} /> Public demo only: details and selected files stay in this browser tab and are not uploaded or saved. Don’t use real personal documents.</div>
        {submitError && <p role="alert" className="upload-error">{submitError}</p>}
        <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={!product.trim() || !fault.trim() || saving}><Sparkles size={16} /> {saving ? "Saving claim…" : "Save claim"}</button></div>
      </form>
      <p className="demo-disclosure">This creates a temporary preview only. It is cleared when you leave or refresh the page; no claim is saved and no analysis runs.</p>
    </div>
  );
}

function UploadField({ id, label, file, onFile }: { id: string; label: string; file: File | null; onFile: (file: File | null) => boolean }) {
  return (
    <div className="upload-field">
      <label htmlFor={id} className="upload-box"><span className="upload-symbol"><Upload size={17} /></span><strong>{file ? file.name : label}</strong><span>{file ? "Selected · change file" : "Choose a file or drop it here"}</span></label>
      <input id={id} className="visually-hidden" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => { if (!onFile(event.target.files?.[0] ?? null)) event.target.value = ""; }} />
    </div>
  );
}
