export type ClaimSubmission = {
  product: string;
  fault: string;
  failureDate: string;
  invoiceName: string;
  warrantyName: string;
  source: "sample" | "local-preview" | "connected";
  claimId?: string;
  status?: string;
  automation?: "not_configured" | "accepted" | "acknowledged" | "pending" | "failed" | "duplicate" | "migration_required";
};

export type ClaimIntakePayload = {
  product: string;
  fault: string;
  failureDate: string;
  invoice: File | null;
  warranty: File | null;
};

export const sampleClaim: ClaimSubmission = {
  product: "Auralis Pulse 2",
  fault: "Left earcup has stopped playing audio",
  failureDate: "",
  invoiceName: "Auralis_purchase_invoice.pdf",
  warrantyName: "Pulse2_warranty_terms.pdf",
  source: "sample",
};
