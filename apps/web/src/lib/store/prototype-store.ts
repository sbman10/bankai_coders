import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type PrototypeProduct = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  seller: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_end: string | null;
  replenishment_days?: number | null;
  replenishment_remind_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PrototypePriceWatch = {
  id: string;
  user_id: string;
  product_id: string;
  product_url: string;
  current_price: number;
  target_price: number;
  currency: string;
  checking_mode: "manual" | "automated";
  last_checked_at: string;
  created_at: string;
  products?: { name: string };
};

export type PrototypeReminder = {
  id: string;
  user_id: string;
  product_id: string;
  remind_at: string;
  channel: "in_app" | "email";
  reason: string;
  status: "scheduled" | "sent" | "cancelled" | "failed";
  created_at: string;
  products?: { name: string };
};

export type PrototypeClaimEvidence = {
  id: string;
  document_id: string | null;
  evidence_kind: "fact" | "warranty_clause" | "missing_item" | "inference";
  content: string;
  source_page: number | null;
  confidence: number | null;
  created_at: string;
};

export type PrototypeClaimApproval = {
  id: string;
  approved_content: string;
  approved_at: string;
  action_status: "draft_only" | "queued" | "sent" | "failed";
};

export type PrototypeClaim = {
  id: string;
  user_id: string;
  product_id: string;
  idempotency_key: string;
  fault_description: string;
  failure_date: string | null;
  status: "received" | "processing" | "needs_information" | "ready_for_review" | "approved" | "action_failed" | "resolved" | "rejected" | "needs_human_help";
  assessment: string | null;
  claim_draft: string | null;
  created_at: string;
  updated_at: string;
  products: { name: string };
  claim_evidence: PrototypeClaimEvidence[];
  claim_approvals: PrototypeClaimApproval[];
};

export type PrototypeDocument = {
  id: string;
  user_id: string;
  product_id: string;
  document_kind: "invoice" | "warranty" | "manual" | "other";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  ingestion_status: "uploaded" | "extracting" | "indexed" | "needs_review" | "failed";
  ingestion_warning_code: string | null;
  created_at: string;
};

type PrototypeDatabase = {
  products: PrototypeProduct[];
  priceWatches: PrototypePriceWatch[];
  reminders: PrototypeReminder[];
  claims: PrototypeClaim[];
  documents: PrototypeDocument[];
};

const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";

function buildInitialData(): PrototypeDatabase {
  const p1Id = "11111111-1111-4111-8111-111111111111";
  const p2Id = "22222222-2222-4222-8222-222222222222";
  const p3Id = "33333333-3333-4333-8333-333333333333";
  const p4Id = "44444444-4444-4444-8444-444444444444";

  return {
    products: [
      {
        id: p1Id,
        user_id: DEFAULT_USER_ID,
        name: "Sony WH-1000XM5 Noise Cancelling Headphones",
        brand: "Sony",
        model: "WH-1000XM5",
        category: "Audio",
        seller: "Amazon India (Appario Retail)",
        serial_number: "SN-SNY-9982412",
        purchase_date: "2024-02-14",
        warranty_end: "2025-02-13",
        replenishment_days: null,
        replenishment_remind_at: null,
        created_at: "2024-02-14T10:30:00Z",
        updated_at: "2024-02-14T10:30:00Z",
      },
      {
        id: p2Id,
        user_id: DEFAULT_USER_ID,
        name: "LG 655L Frost-Free Side-by-Side Refrigerator",
        brand: "LG",
        model: "GL-X257AMCX",
        category: "Appliances",
        seller: "Croma Retail Indiranagar",
        serial_number: "SN-LG-8874102",
        purchase_date: "2023-11-20",
        warranty_end: "2024-11-19",
        replenishment_days: 365,
        replenishment_remind_at: "2024-11-05",
        created_at: "2023-11-20T14:15:00Z",
        updated_at: "2023-11-20T14:15:00Z",
      },
      {
        id: p3Id,
        user_id: DEFAULT_USER_ID,
        name: "Minimalist SPF 50 PA++++ Sunscreen 50g",
        brand: "Minimalist",
        model: "SPF50-50G",
        category: "Personal Care",
        seller: "Nykaa E-Retail",
        serial_number: "SN-MIN-44120",
        purchase_date: "2024-09-01",
        warranty_end: "2025-09-01",
        replenishment_days: 60,
        replenishment_remind_at: "2024-10-31",
        created_at: "2024-09-01T09:00:00Z",
        updated_at: "2024-09-01T09:00:00Z",
      },
      {
        id: p4Id,
        user_id: DEFAULT_USER_ID,
        name: 'Apple MacBook Air 15" M3',
        brand: "Apple",
        model: "MBA-15-M3",
        category: "Computers",
        seller: "Apple Store BKC Mumbai",
        serial_number: "SN-C02XYZ123ABC",
        purchase_date: "2024-04-10",
        warranty_end: "2025-04-09",
        replenishment_days: null,
        replenishment_remind_at: null,
        created_at: "2024-04-10T12:00:00Z",
        updated_at: "2024-04-10T12:00:00Z",
      },
    ],
    priceWatches: [
      {
        id: "watch-001",
        user_id: DEFAULT_USER_ID,
        product_id: p1Id,
        product_url: "https://www.amazon.in/dp/B0CX21C8S2",
        current_price: 24990,
        target_price: 26000,
        currency: "INR",
        checking_mode: "manual",
        last_checked_at: new Date().toISOString(),
        created_at: "2024-03-01T10:00:00Z",
        products: { name: "Sony WH-1000XM5 Noise Cancelling Headphones" },
      },
      {
        id: "watch-002",
        user_id: DEFAULT_USER_ID,
        product_id: p4Id,
        product_url: "https://www.apple.com/in/shop/buy-mac/macbook-air",
        current_price: 134900,
        target_price: 125000,
        currency: "INR",
        checking_mode: "manual",
        last_checked_at: new Date().toISOString(),
        created_at: "2024-05-01T11:00:00Z",
        products: { name: 'Apple MacBook Air 15" M3' },
      },
    ],
    reminders: [
      {
        id: "rem-001",
        user_id: DEFAULT_USER_ID,
        product_id: p2Id,
        remind_at: "2024-11-05T09:00:00Z",
        channel: "in_app",
        reason: "LG Refrigerator annual maintenance check (estimated 365-day interval)",
        status: "scheduled",
        created_at: "2023-11-20T14:15:00Z",
        products: { name: "LG 655L Frost-Free Side-by-Side Refrigerator" },
      },
      {
        id: "rem-002",
        user_id: DEFAULT_USER_ID,
        product_id: p3Id,
        remind_at: "2024-10-31T09:00:00Z",
        channel: "in_app",
        reason: "Minimalist Sunscreen bottle refill due (estimated 60-day interval)",
        status: "scheduled",
        created_at: "2024-09-01T09:00:00Z",
        products: { name: "Minimalist SPF 50 PA++++ Sunscreen 50g" },
      },
    ],
    claims: [
      {
        id: "claim-001",
        user_id: DEFAULT_USER_ID,
        product_id: p1Id,
        idempotency_key: "00000000-0000-4000-8000-000000000010",
        fault_description: "Left earcup stopped producing audio after 8 months of normal indoor use. No drops, physical damage or liquid exposure.",
        failure_date: "2024-10-14",
        status: "ready_for_review",
        assessment: "likely within stated term",
        claim_draft: "Dear Sony India Customer Support,\n\nI am submitting a warranty service request for my Sony WH-1000XM5 Wireless Headphones (Serial No. SN-SNY-9982412), purchased on February 14, 2024 from Amazon India.\n\nThe left earcup stopped outputting audio during normal listening on October 14, 2024. The headset is in clean cosmetic condition with no impact, liquid, or accidental damage. A copy of the Amazon purchase tax invoice is attached verifying purchase within the 1-year manufacturer warranty period.\n\nPlease share service center drop-off or pickup instructions for inspection and warranty repair/replacement.\n\nRegards,\nRohan Sharma",
        created_at: "2024-10-15T09:30:00Z",
        updated_at: "2024-10-15T09:30:00Z",
        products: { name: "Sony WH-1000XM5 Noise Cancelling Headphones" },
        claim_evidence: [
          {
            id: "ev-001",
            document_id: "doc-001",
            evidence_kind: "fact",
            content: "Purchase Invoice: February 14, 2024 (Invoice #INV-2024-88412)",
            source_page: 1,
            confidence: 0.99,
            created_at: "2024-10-15T09:31:00Z",
          },
          {
            id: "ev-002",
            document_id: "doc-002",
            evidence_kind: "warranty_clause",
            content: "Section 2.1: Sony provides 12 months limited hardware warranty from date of original consumer purchase for internal acoustic drivers.",
            source_page: 2,
            confidence: 0.96,
            created_at: "2024-10-15T09:31:00Z",
          },
        ],
        claim_approvals: [],
      },
    ],
    documents: [
      {
        id: "doc-001",
        user_id: DEFAULT_USER_ID,
        product_id: p1Id,
        document_kind: "invoice",
        storage_path: "demo/sony-headphones-invoice.pdf",
        original_filename: "sony-xm5-amazon-tax-invoice.pdf",
        mime_type: "application/pdf",
        size_bytes: 248190,
        ingestion_status: "indexed",
        ingestion_warning_code: null,
        created_at: "2024-02-14T10:35:00Z",
      },
      {
        id: "doc-002",
        user_id: DEFAULT_USER_ID,
        product_id: p1Id,
        document_kind: "warranty",
        storage_path: "demo/sony-headphones-warranty.pdf",
        original_filename: "sony-india-audio-warranty-terms.pdf",
        mime_type: "application/pdf",
        size_bytes: 412850,
        ingestion_status: "indexed",
        ingestion_warning_code: null,
        created_at: "2024-02-14T10:36:00Z",
      },
    ],
  };
}

class PrototypeStore {
  private data: PrototypeDatabase;
  private filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), ".prototype-data.json");
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): PrototypeDatabase {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    const initial = buildInitialData();
    this.saveToDisk(initial);
    return initial;
  }

  private saveToDisk(dataToSave: PrototypeDatabase = this.data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(dataToSave, null, 2), "utf8");
    } catch {
      // In read-only or container environments, fallback gracefully
    }
  }

  // ── Products ───────────────────────────────────────────────────────────────
  getProducts(): PrototypeProduct[] {
    return [...this.data.products].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getProduct(id: string): PrototypeProduct | undefined {
    return this.data.products.find((p) => p.id === id);
  }

  createProduct(input: {
    name: string;
    brand?: string | null;
    model?: string | null;
    category?: string;
    seller?: string | null;
    serial_number?: string | null;
    purchase_date?: string | null;
    warranty_end?: string | null;
  }): PrototypeProduct {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProduct: PrototypeProduct = {
      id,
      user_id: DEFAULT_USER_ID,
      name: input.name,
      brand: input.brand ?? null,
      model: input.model ?? null,
      category: input.category ?? "Other",
      seller: input.seller ?? null,
      serial_number: input.serial_number ?? null,
      purchase_date: input.purchase_date ?? null,
      warranty_end: input.warranty_end ?? null,
      replenishment_days: null,
      replenishment_remind_at: null,
      created_at: now,
      updated_at: now,
    };
    this.data.products.unshift(newProduct);
    this.saveToDisk();
    return newProduct;
  }

  updateProduct(id: string, partial: Partial<PrototypeProduct>): PrototypeProduct | null {
    const index = this.data.products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    const updated: PrototypeProduct = {
      ...this.data.products[index],
      ...partial,
      updated_at: new Date().toISOString(),
    };
    this.data.products[index] = updated;
    this.saveToDisk();
    return updated;
  }

  deleteProduct(id: string): boolean {
    const initialLen = this.data.products.length;
    this.data.products = this.data.products.filter((p) => p.id !== id);
    this.data.priceWatches = this.data.priceWatches.filter((w) => w.product_id !== id);
    this.data.reminders = this.data.reminders.filter((r) => r.product_id !== id);
    this.data.documents = this.data.documents.filter((d) => d.product_id !== id);
    this.saveToDisk();
    return this.data.products.length < initialLen;
  }

  // ── Price Watches ──────────────────────────────────────────────────────────
  getPriceWatches(): PrototypePriceWatch[] {
    return [...this.data.priceWatches].map((w) => {
      const prod = this.getProduct(w.product_id);
      return {
        ...w,
        products: prod ? { name: prod.name } : { name: "Product" },
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  createPriceWatch(input: {
    productId: string;
    productUrl: string;
    currentPrice: number;
    targetPrice: number;
    currency?: string;
  }): PrototypePriceWatch {
    const id = crypto.randomUUID();
    const prod = this.getProduct(input.productId);
    const newWatch: PrototypePriceWatch = {
      id,
      user_id: DEFAULT_USER_ID,
      product_id: input.productId,
      product_url: input.productUrl,
      current_price: input.currentPrice,
      target_price: input.targetPrice,
      currency: input.currency ?? "INR",
      checking_mode: "manual",
      last_checked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      products: prod ? { name: prod.name } : { name: "Product" },
    };
    this.data.priceWatches.unshift(newWatch);
    this.saveToDisk();
    return newWatch;
  }

  updatePriceWatch(id: string, currentPrice: number): PrototypePriceWatch | null {
    const watch = this.data.priceWatches.find((w) => w.id === id);
    if (!watch) return null;
    watch.current_price = currentPrice;
    watch.last_checked_at = new Date().toISOString();
    const prod = this.getProduct(watch.product_id);
    watch.products = prod ? { name: prod.name } : { name: "Product" };
    this.saveToDisk();
    return watch;
  }

  deletePriceWatch(id: string): boolean {
    const len = this.data.priceWatches.length;
    this.data.priceWatches = this.data.priceWatches.filter((w) => w.id !== id);
    this.saveToDisk();
    return this.data.priceWatches.length < len;
  }

  // ── Reminders ──────────────────────────────────────────────────────────────
  getReminders(): PrototypeReminder[] {
    return [...this.data.reminders].map((r) => {
      const prod = this.getProduct(r.product_id);
      return {
        ...r,
        products: prod ? { name: prod.name } : { name: "Product" },
      };
    }).sort((a, b) => a.remind_at.localeCompare(b.remind_at));
  }

  createReminder(input: {
    productId: string;
    estimateDays: number;
    remindAt: string;
  }): PrototypeReminder {
    const id = crypto.randomUUID();
    const prod = this.getProduct(input.productId);
    const productName = prod?.name ?? "Product";
    const newReminder: PrototypeReminder = {
      id,
      user_id: DEFAULT_USER_ID,
      product_id: input.productId,
      remind_at: new Date(input.remindAt).toISOString(),
      channel: "in_app",
      reason: `${productName} maintenance or refill (estimated ${input.estimateDays}-day interval)`,
      status: "scheduled",
      created_at: new Date().toISOString(),
      products: { name: productName },
    };
    this.data.reminders.push(newReminder);
    this.saveToDisk();
    return newReminder;
  }

  deleteReminder(id: string): boolean {
    const len = this.data.reminders.length;
    this.data.reminders = this.data.reminders.filter((r) => r.id !== id);
    this.saveToDisk();
    return this.data.reminders.length < len;
  }

  // ── Claims ─────────────────────────────────────────────────────────────────
  getClaims(): PrototypeClaim[] {
    return [...this.data.claims].map((c) => {
      const prod = this.getProduct(c.product_id);
      return {
        ...c,
        products: prod ? { name: prod.name } : c.products ?? { name: "Product" },
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getClaim(id: string): PrototypeClaim | undefined {
    return this.data.claims.find((c) => c.id === id);
  }

  createClaim(input: {
    productName: string;
    fault: string;
    failureDate?: string | null;
    invoiceName?: string;
    warrantyName?: string;
  }): PrototypeClaim {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Find or create product
    let prod = this.data.products.find((p) => p.name.toLowerCase() === input.productName.toLowerCase());
    if (!prod) {
      prod = this.createProduct({ name: input.productName });
    }

    const newClaim: PrototypeClaim = {
      id,
      user_id: DEFAULT_USER_ID,
      product_id: prod.id,
      idempotency_key: crypto.randomUUID(),
      fault_description: input.fault,
      failure_date: input.failureDate ?? null,
      status: "ready_for_review",
      assessment: "likely within stated term",
      claim_draft: `Dear ${prod.brand || "Manufacturer"} Customer Support,\n\nI am submitting a warranty claim for my ${prod.name}.\n\nIssue: ${input.fault}\nDate issue began: ${input.failureDate || "Recently"}\n\nThe product has been used as intended with no physical or liquid damage. Supporting documents are on file verifying warranty coverage.\n\nPlease advise on warranty service or replacement.\n\nThank you.`,
      created_at: now,
      updated_at: now,
      products: { name: prod.name },
      claim_evidence: [
        {
          id: crypto.randomUUID(),
          document_id: null,
          evidence_kind: "fact",
          content: `Reported Fault: ${input.fault}`,
          source_page: 1,
          confidence: 0.95,
          created_at: now,
        },
      ],
      claim_approvals: [],
    };

    this.data.claims.unshift(newClaim);
    this.saveToDisk();
    return newClaim;
  }

  approveClaim(claimId: string, approvedContent: string): boolean {
    const claim = this.data.claims.find((c) => c.id === claimId);
    if (!claim) return false;

    claim.status = "approved";
    claim.claim_draft = approvedContent;
    claim.claim_approvals.unshift({
      id: crypto.randomUUID(),
      approved_content: approvedContent,
      approved_at: new Date().toISOString(),
      action_status: "draft_only",
    });
    claim.updated_at = new Date().toISOString();
    this.saveToDisk();
    return true;
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  getProductDocuments(productId: string): PrototypeDocument[] {
    return this.data.documents.filter((d) => d.product_id === productId);
  }

  createProductDocument(input: {
    productId: string;
    documentKind: "invoice" | "warranty" | "manual" | "other";
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath?: string;
  }): PrototypeDocument {
    const id = crypto.randomUUID();
    const newDoc: PrototypeDocument = {
      id,
      user_id: DEFAULT_USER_ID,
      product_id: input.productId,
      document_kind: input.documentKind,
      storage_path: input.storagePath ?? `demo/${id}-${input.fileName}`,
      original_filename: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      ingestion_status: "indexed",
      ingestion_warning_code: null,
      created_at: new Date().toISOString(),
    };
    this.data.documents.unshift(newDoc);
    this.saveToDisk();
    return newDoc;
  }

  deleteProductDocument(docId: string): boolean {
    const len = this.data.documents.length;
    this.data.documents = this.data.documents.filter((d) => d.id !== docId);
    this.saveToDisk();
    return this.data.documents.length < len;
  }

  // ── Assistant Q&A ──────────────────────────────────────────────────────────
  answerQuestion(question: string, productIds: string[], documentIds: string[]) {
    const q = question.toLowerCase();
    const relevantProds = this.data.products.filter((p) => productIds.includes(p.id));
    const targetProd = relevantProds[0] || this.data.products[0];

    if (q.includes("warranty") || q.includes("cover") || q.includes("period") || q.includes("damage")) {
      return {
        status: "supported" as const,
        answer: `According to the documented warranty terms for ${targetProd?.name || "your product"}, standard coverage applies for 12 months from the verified invoice date. Internal component failures and acoustic driver defects under normal use are fully covered. Accidental impact, liquid ingress, or unauthorized opening void coverage.`,
        documentFacts: [
          `Invoice date: ${targetProd?.purchase_date || "February 14, 2024"}`,
          `Warranty end date: ${targetProd?.warranty_end || "February 13, 2025"}`,
          "Coverage term: 12 months limited manufacturer warranty",
        ],
        userFactsUsed: [
          `Product registered: ${targetProd?.name || "Sony WH-1000XM5"}`,
          `Serial Number: ${targetProd?.serial_number || "SN-SNY-9982412"}`,
        ],
        inferences: [
          "The claim is within the active manufacturer warranty window.",
        ],
        citations: [
          {
            chunkId: "chunk-01",
            documentId: documentIds[0] || "doc-001",
            documentName: "sony-india-audio-warranty-terms.pdf",
            page: 1,
            section: "Limited Warranty Terms § 2.1",
            excerpt: "Sony India warrants that this product will be free from defects in materials and workmanship for a period of one (1) year from original purchase date.",
          },
          {
            chunkId: "chunk-02",
            documentId: documentIds[1] || "doc-002",
            documentName: "sony-xm5-amazon-tax-invoice.pdf",
            page: 1,
            section: "Tax Invoice Details",
            excerpt: "Tax Invoice / Bill of Supply: Serial No. verified, Date of Sale: 14 Feb 2024.",
          },
        ],
        missingInformation: [],
        followUpQuestions: [
          "Would you like to draft a formal warranty claim letter using these citations?",
          "Do you have photographs of the device to confirm no physical impact?",
        ],
      };
    }

    if (q.includes("serial") || q.includes("model") || q.includes("number")) {
      return {
        status: "supported" as const,
        answer: `The recorded serial number for ${targetProd?.name || "the product"} is ${targetProd?.serial_number || "SN-SNY-9982412"}, with model designation ${targetProd?.model || "WH-1000XM5"}.`,
        documentFacts: [`Serial Number: ${targetProd?.serial_number || "SN-SNY-9982412"}`],
        userFactsUsed: [`Product: ${targetProd?.name}`],
        inferences: [],
        citations: [
          {
            chunkId: "chunk-03",
            documentId: documentIds[0] || "doc-001",
            documentName: "sony-xm5-amazon-tax-invoice.pdf",
            page: 1,
            section: "Item Description & Serial",
            excerpt: `Item: ${targetProd?.name} | S/N: ${targetProd?.serial_number}`,
          },
        ],
        missingInformation: [],
        followUpQuestions: [],
      };
    }

    return {
      status: "supported" as const,
      answer: `Based on your attached documents for ${targetProd?.name || "your product"}, purchase occurred on ${targetProd?.purchase_date || "February 14, 2024"} from ${targetProd?.seller || "Amazon India"}. Warranty coverage remains active through ${targetProd?.warranty_end || "February 13, 2025"}.`,
      documentFacts: [
        `Purchase date: ${targetProd?.purchase_date || "2024-02-14"}`,
        `Seller: ${targetProd?.seller || "Amazon India"}`,
      ],
      userFactsUsed: [],
      inferences: ["Product passport documentation is complete and verified."],
      citations: [
        {
          chunkId: "chunk-04",
          documentId: documentIds[0] || "doc-001",
          documentName: "sony-xm5-amazon-tax-invoice.pdf",
          page: 1,
          section: "Invoice Summary",
          excerpt: `Purchase of ${targetProd?.name} confirmed on ${targetProd?.purchase_date}.`,
        },
      ],
      missingInformation: [],
      followUpQuestions: [
        "Would you like to review coverage terms for a specific issue?",
      ],
    };
  }
}

export const prototypeStore = new PrototypeStore();
