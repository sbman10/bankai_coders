-- Add document_label to public.product_documents for custom document naming
alter table public.product_documents
  add column if not exists document_label text;
