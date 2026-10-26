"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, FileCheck2, FileText, LoaderCircle, Send, ShieldCheck, Sparkles } from "lucide-react";

type Product = { id: string; name: string };
type ProductDocument = {
  id: string;
  product_id: string;
  document_kind: string;
  original_filename: string;
  ingestion_status: "uploaded" | "extracting" | "indexed" | "needs_review" | "failed";
  ingestion_warning_code: string | null;
};
type Citation = { chunkId: string; documentId: string; documentName: string; page: number | null; section: string | null; excerpt: string };
type Answer = {
  status: "supported" | "conditional" | "insufficient_evidence" | "conflicting_terms";
  answer: string;
  documentFacts: string[];
  userFactsUsed: string[];
  inferences: string[];
  citations: Citation[];
  missingInformation: string[];
  followUpQuestions: string[];
};
type Message = { id: number; question: string; answer?: Answer; error?: string };

const statusLabels: Record<Answer["status"], string> = {
  supported: "SUPPORTED BY SELECTED TEXT",
  conditional: "CONDITIONAL — CHECK THE DETAILS",
  insufficient_evidence: "NOT ENOUGH EVIDENCE",
  conflicting_terms: "TERMS APPEAR TO CONFLICT",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  const result = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "The assistant is unavailable. Please try again.");
  return result;
}

export function AssistantChat() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [indexingId, setIndexingId] = useState("");
  const [error, setError] = useState("");
  const [nextMessageId, setNextMessageId] = useState(1);

  useEffect(() => {
    let active = true;
    requestJson<{ products: Product[] }>("/api/products").then(({ products: ownedProducts }) => {
      if (!active) return;
      setProducts(ownedProducts);
      setProductId(ownedProducts[0]?.id ?? "");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Your products could not be loaded.");
    }).finally(() => {
      if (active) setContextLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!productId) {
      setDocuments([]);
      setSelectedDocumentIds([]);
      return;
    }
    let active = true;
    setDocumentsLoading(true);
    setDocuments([]);
    setSelectedDocumentIds([]);
    setMessages([]);
    setQuestion("");
    requestJson<{ documents: ProductDocument[] }>(`/api/products/${productId}/documents`).then(({ documents: ownedDocuments }) => {
      if (active) setDocuments(ownedDocuments);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "The product documents could not be loaded.");
    }).finally(() => {
      if (active) setDocumentsLoading(false);
    });
    return () => { active = false; };
  }, [productId]);

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((selected) => selected.includes(documentId)
      ? selected.filter((id) => id !== documentId)
      : selected.length < 6 ? [...selected, documentId] : selected);
  }

  async function prepareDocument(document: ProductDocument) {
    setError("");
    setIndexingId(document.id);
    try {
      const result = await requestJson<{ status: ProductDocument["ingestion_status"]; reason?: string }>(
        `/api/products/${productId}/documents/${document.id}/index`, { method: "POST" },
      );
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, ingestion_status: result.status, ingestion_warning_code: result.reason ?? null } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document could not be prepared.");
    } finally {
      setIndexingId("");
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || selectedDocumentIds.length === 0 || question.trim().length < 3 || sending) return;
    const asked = question.trim();
    const messageId = nextMessageId;
    setNextMessageId((id) => id + 1);
    setMessages((current) => [...current, { id: messageId, question: asked }]);
    setQuestion("");
    setError("");
    setSending(true);
    try {
      const answer = await requestJson<Answer>("/api/assistant/answer", {
        method: "POST",
        body: JSON.stringify({ productId, documentIds: selectedDocumentIds, question: asked }),
      });
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, answer } : message));
    } catch (cause) {
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, error: cause instanceof Error ? cause.message : "The assistant could not answer." }
        : message));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-content subpage-content assistant-page">
      <div className="eyebrow"><span className="eyebrow-line" /> DOCUMENT-GROUNDED Q&A</div>
      <div className="product-page-heading"><div><h1>Ask about your documents.</h1><p>Explore the wording in the documents you choose. Answers are explanations of supplied text, not coverage decisions.</p></div><span className="local-mode-pill">READ ONLY</span></div>
      {error && <p className="product-feedback product-feedback-error" role="alert"><AlertTriangle size={15} />{error}</p>}
      <div className="assistant-layout">
        <aside className="assistant-context" aria-label="Document context">
          <div className="assistant-context-heading"><span className="tool-icon"><FileCheck2 size={16} /></span><div><h2>Your sources</h2><p>Choose one product and the documents to search.</p></div></div>
          {contextLoading ? <p role="status" className="tool-empty">Loading your products…</p> : products.length === 0 ? <p className="tool-empty">No saved products yet. Add a product and attach its warranty or policy documents first.</p> : <>
            <label className="assistant-label" htmlFor="assistant-product">Product</label>
            <select id="assistant-product" className="assistant-select" value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <h3 className="assistant-source-title">Documents</h3>
            {documentsLoading ? <p role="status" className="tool-empty">Loading product documents…</p> : documents.length === 0 ? <p className="tool-empty">No documents are attached to this product.</p> : <ul className="assistant-document-list">
              {documents.map((document) => <li key={document.id}>
                {document.ingestion_status === "indexed" ? <label className="assistant-document-choice">
                  <input type="checkbox" aria-label={`${document.original_filename}, ${document.document_kind}, ready for questions`} checked={selectedDocumentIds.includes(document.id)} disabled={!selectedDocumentIds.includes(document.id) && selectedDocumentIds.length >= 6} onChange={() => toggleDocument(document.id)} />
                  <FileText size={16} aria-hidden="true" />
                  <span><strong>{document.original_filename}</strong><small>{document.document_kind.replaceAll("_", " ")} · ready for questions</small></span>
                </label> : <div className="assistant-document-state">
                  <FileText size={16} aria-hidden="true" />
                  <span><strong>{document.original_filename}</strong><small>{document.document_kind.replaceAll("_", " ")} · {document.ingestion_status.replaceAll("_", " ")}</small></span>
                  {document.ingestion_status === "uploaded" || document.ingestion_status === "failed" ? <button type="button" className="text-button" disabled={Boolean(indexingId)} onClick={() => void prepareDocument(document)}>
                    {indexingId === document.id ? <><LoaderCircle size={13} className="assistant-spinner" /> Preparing</> : "Prepare for questions"}
                  </button> : document.ingestion_status === "needs_review" ? <span className="assistant-review-note">{document.ingestion_warning_code === "ocr_required" || document.ingestion_warning_code === "text_incomplete_or_ocr_required" ? "OCR is needed; not searchable yet." : "Review this file before using it."}</span> : <span className="assistant-review-note">Processing</span>}
                </div>}
              </li>)}
            </ul>}
          </>}
          <p className="assistant-privacy-note"><ShieldCheck size={14} /> Only selected documents from this product are searched.</p>
          <p className="assistant-provider-note">To answer, Product Vault sends your question and selected text excerpts to its configured AI provider. Don’t select documents you are not authorized to share.</p>
        </aside>

        <section className="assistant-conversation" aria-label="Warranty and policy conversation">
          <div className="assistant-thread" aria-live="polite">
            {messages.length === 0 ? <div className="assistant-welcome"><span className="assistant-welcome-icon"><Sparkles size={18} /></span><h2>A clearer read, grounded in your sources.</h2><p>Select an indexed document, then ask about a term, exclusion, condition, or claim requirement.</p><span>Example: “What does the policy say about accidental damage?”</span></div> : messages.map((message) => <article className="assistant-exchange" key={message.id}>
              <div className="assistant-question"><span>You asked</span><p>{message.question}</p></div>
              {message.error ? <p className="assistant-answer-error" role="alert">{message.error}</p> : !message.answer ? <p className="assistant-pending" role="status"><LoaderCircle size={14} className="assistant-spinner" /> Checking the selected text…</p> : <AnswerCard answer={message.answer} />}
            </article>)}
          </div>
          <form className="assistant-composer" onSubmit={ask}>
            <label htmlFor="assistant-question">Ask about your documents</label>
            <textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder="Ask about a clause, exclusion, condition, or requirement…" />
            <div className="assistant-composer-footer"><span>Answers use only selected indexed text and may abstain when it’s unclear.</span><button className="button button-primary" type="submit" disabled={sending || selectedDocumentIds.length === 0 || question.trim().length < 3}><Send size={14} /> {sending ? "Checking…" : "Ask Product Vault"}</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}

function AnswerCard({ answer }: { answer: Answer }) {
  return <div className={`assistant-answer assistant-answer-${answer.status}`}>
    <div className="assistant-answer-label"><span className="assistant-answer-dot" />{statusLabels[answer.status]}</div>
    <p className="assistant-answer-copy">{answer.answer}</p>
    {answer.documentFacts.length > 0 && <AnswerList title="What the selected documents say" items={answer.documentFacts} />}
    {answer.userFactsUsed.length > 0 && <AnswerList title="Details you provided" items={answer.userFactsUsed} />}
    {answer.inferences.length > 0 && <AnswerList title="Careful interpretation" items={answer.inferences} />}
    {answer.missingInformation.length > 0 && <AnswerList title="What’s missing" items={answer.missingInformation} />}
    {answer.followUpQuestions.length > 0 && <AnswerList title="Questions to clarify" items={answer.followUpQuestions} />}
    {answer.citations.length > 0 && <div className="assistant-citations"><h3>Sources</h3>{answer.citations.map((citation) => <details key={citation.chunkId}>
      <summary>{citation.documentName}{citation.page ? ` · Page ${citation.page}` : ""}{citation.section ? ` · ${citation.section}` : ""}</summary>
      <blockquote>{citation.excerpt}</blockquote>
    </details>)}</div>}
    <p className="assistant-disclaimer">This is an explanation of supplied wording, not an insurer or manufacturer decision, a guarantee, or legal advice.</p>
  </div>;
}

function AnswerList({ title, items }: { title: string; items: string[] }) {
  return <section className="assistant-answer-list"><h3>{title}</h3><ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>;
}
