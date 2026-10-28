"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  FileText,
  GitCommit,
  HelpCircle,
  Package,
  Search,
  SearchX,
  Shield,
  ShieldCheck,
  TrendingDown,
  X,
} from "lucide-react";
import type { WorkspaceView } from "./workspace-routes";
import "./HelpSupport.css";

interface HelpSupportProps {
  onBack: () => void;
  onNavigate: (view: WorkspaceView) => void;
}

type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  actionLabel?: string;
  actionView?: WorkspaceView;
};

const faqDatabase: FaqItem[] = [
  // 1. Getting Started
  {
    id: "gs-add-product",
    category: "Getting Started",
    question: "How do I add a product to my workspace?",
    answer:
      "Go to 'My Products' and click '+ Add Product'. You can upload a purchase invoice (PDF, JPEG, or PNG) for automatic OCR text extraction, or fill in product attributes manually (brand, model, purchase date, invoice price, and warranty duration).",
    actionLabel: "Go to My Products",
    actionView: "products",
  },
  {
    id: "gs-demo-vs-account",
    category: "Getting Started",
    question: "What is the difference between this interactive workspace and a cloud account?",
    answer:
      "In this interactive workspace session, 12 consumer products are loaded directly in your browser with local invoice parsing and manual price tracking. A connected Supabase account enables multi-device cloud synchronization, permanent private document storage, and outbound email alerts.",
    actionLabel: "Explore Dashboard",
    actionView: "workspace",
  },

  // 2. Product Passports
  {
    id: "pp-what-is-passport",
    category: "Product Passports",
    question: "What information is tracked in a Product Passport?",
    answer:
      "Each Product Passport consolidates the essential ownership record: brand, serial number, purchase price, purchase date, warranty end date, AMC coverage status, linked invoices, and a chronological history of all price checks, service reminders, and claims.",
    actionLabel: "View Product Catalogue",
    actionView: "products",
  },
  {
    id: "pp-warranty-status",
    category: "Product Passports",
    question: "How does ProductVault determine if a warranty or AMC is active?",
    answer:
      "ProductVault calculates remaining coverage by comparing the purchase date plus warranty months against today's date. Items nearing expiration within 30 days display 'Renew Soon' badges and trigger reminder notifications 14 days in advance.",
  },

  // 3. Documents & Invoices
  {
    id: "doc-formats",
    category: "Documents & OCR",
    question: "What file types and sizes are supported for document uploads?",
    answer:
      "ProductVault accepts PDF, JPEG, PNG, and WebP documents up to 10 MB per file. Invoices are parsed client-side using Tesseract OCR and Canvas rendering to extract dates, model numbers, and purchase totals without sharing unredacted text.",
  },
  {
    id: "doc-assistant-qa",
    category: "Documents & OCR",
    question: "How does the Documents Q&A Assistant answer questions?",
    answer:
      "The Documents Q&A tool allows you to query your uploaded product documentation. It scans indexed clauses and terms, citing verbatim sources so you can quickly locate coverage exclusions, service procedures, or serial numbers.",
    actionLabel: "Open Documents Q&A",
    actionView: "assistant",
  },

  // 4. Price Watch
  {
    id: "pw-how-it-works",
    category: "Price Watch",
    question: "How do I monitor price drops on Amazon or Flipkart?",
    answer:
      "Paste any product URL from Amazon.in or Flipkart into Price Watch and set your desired target price. ProductVault logs price observations, displays cross-store availability, and creates an in-app alert when a retailer's price meets your threshold.",
    actionLabel: "Open Price Watch",
    actionView: "prices",
  },
  {
    id: "pw-manual-vs-auto",
    category: "Price Watch",
    question: "Are price checks automated in real-time or triggered manually?",
    answer:
      "In this MVP environment, price checks are triggered on-demand via the Price Watch interface. Scheduled automated background scraping across multiple marketplaces is currently in development.",
  },

  // 5. Reminders & Timeline
  {
    id: "rem-how-scheduled",
    category: "Reminders & Timeline",
    question: "How do usage and replenishment reminders work?",
    answer:
      "You can set a custom reminder based on your estimated usage period (e.g. 45 days for sunscreen, 6 months for water filters, or 12 months for appliance AMC). Countdowns update daily and appear in your dashboard and notification center.",
    actionLabel: "Manage Reminders",
    actionView: "reminders",
  },
  {
    id: "rem-timeline-beam",
    category: "Reminders & Timeline",
    question: "What is the Unified Timeline and orange scroll beam?",
    answer:
      "The Unified Timeline arranges all your product events chronologically: purchase dates, warranty expirations, claims, and service reminders. The orange scroll beam visually follows your reading progress down the event rail.",
    actionLabel: "View Timeline",
    actionView: "timeline",
  },

  // 6. Warranty Claims & Safety
  {
    id: "cl-workflow-steps",
    category: "Warranty Claims",
    question: "How does the Claim Intake workflow process warranty claims?",
    answer:
      "Claim Intake follows a structured 4-step pipeline: (1) Issue description & document upload, (2) Invoice fact extraction, (3) Coverage assessment with evidence citations, and (4) Draft review. You can edit the drafted claim letter before approving it.",
    actionLabel: "Start a Claim",
    actionView: "intake",
  },
  {
    id: "cl-human-safety-rule",
    category: "Warranty Claims",
    question: "Does ProductVault ever send emails or warranty claims automatically?",
    answer:
      "Never. ProductVault strictly enforces an immutable human-in-the-loop safety rule: no warranty claim, dispute letter, or external email can ever be dispatched without your explicit, recorded approval on the exact review screen.",
    actionLabel: "Review Claims Vault",
    actionView: "claims",
  },
];

const categories = [
  "All Topics",
  "Getting Started",
  "Product Passports",
  "Documents & OCR",
  "Price Watch",
  "Reminders & Timeline",
  "Warranty Claims",
];

const categoryIcons: Record<string, React.ReactNode> = {
  "Getting Started": <HelpCircle size={16} />,
  "Product Passports": <Package size={16} />,
  "Documents & OCR": <FileText size={16} />,
  "Price Watch": <TrendingDown size={16} />,
  "Reminders & Timeline": <GitCommit size={16} />,
  "Warranty Claims": <ShieldCheck size={16} />,
};

export function HelpSupport({ onBack, onNavigate }: HelpSupportProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Topics");
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(
    new Set(["gs-add-product", "cl-human-safety-rule"])
  );

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter FAQs by search query and category
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqDatabase.filter((item) => {
      const matchesCategory =
        selectedCategory === "All Topics" || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  // Group filtered FAQs by category
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, FaqItem[]> = {};
    for (const item of filteredFaqs) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredFaqs]);

  return (
    <section className="help-support-container" aria-labelledby="help-support-title">
      {/* Header */}
      <div className="help-header-wrap">
        <button type="button" className="help-back-btn" onClick={onBack}>
          <ChevronLeft size={16} /> Back to dashboard
        </button>
        <div className="help-eyebrow">
          <span className="help-eyebrow-line" /> HELP &amp; SUPPORT
        </div>
        <h1 id="help-support-title" className="help-title">
          How can we help?
        </h1>
        <p className="help-description">
          Find practical guidance for managing your products, documents, reminders, price watches, and warranty claims.
        </p>
      </div>

      {/* Search Input */}
      <div className="help-search-card" role="search">
        <Search size={18} className="help-search-icon" aria-hidden="true" />
        <input
          id="help-search-input"
          className="help-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help topics (e.g. invoice upload, warranty claim, price watch, reminders)..."
          aria-label="Search help topics"
        />
        {searchQuery && (
          <button
            type="button"
            className="help-search-clear"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search query"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="help-category-pills" role="tablist" aria-label="Help categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat}
            className={`help-category-pill ${selectedCategory === cat ? "is-active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQs List or Empty State */}
      {filteredFaqs.length === 0 ? (
        <div className="help-no-results">
          <div className="help-no-results-icon">
            <SearchX size={24} />
          </div>
          <h2 className="help-no-results-title">No help topics found</h2>
          <p className="help-no-results-desc">
            No help articles matched &ldquo;{searchQuery}&rdquo;. Try searching for broader terms like &ldquo;warranty&rdquo;, &ldquo;invoice&rdquo;, &ldquo;price&rdquo;, or &ldquo;claim&rdquo;.
          </p>
          <button
            type="button"
            className="help-clear-search-btn"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All Topics");
            }}
          >
            Clear search filters
          </button>
        </div>
      ) : (
        Object.entries(groupedFaqs).map(([categoryName, items]) => (
          <div key={categoryName} className="help-category-block">
            <div className="help-category-header">
              <span className="help-category-icon" aria-hidden="true">
                {categoryIcons[categoryName] || <HelpCircle size={16} />}
              </span>
              <h2 className="help-category-title">{categoryName}</h2>
            </div>

            <div className="help-faq-list">
              {items.map((item) => {
                const isOpen = openFaqIds.has(item.id);
                return (
                  <div key={item.id} className={`help-faq-item ${isOpen ? "is-open" : ""}`}>
                    <button
                      type="button"
                      className="help-faq-trigger"
                      onClick={() => toggleFaq(item.id)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${item.id}`}
                    >
                      <span className="help-faq-question">{item.question}</span>
                      <ChevronDown size={16} className="help-faq-chevron" aria-hidden="true" />
                    </button>

                    {isOpen && (
                      <div id={`faq-answer-${item.id}`} className="help-faq-content">
                        <p className="help-faq-answer">{item.answer}</p>
                        {item.actionLabel && item.actionView && (
                          <div className="help-faq-action-row">
                            <button
                              type="button"
                              className="help-faq-nav-btn"
                              onClick={() => onNavigate(item.actionView!)}
                            >
                              <span>{item.actionLabel}</span>
                              <ArrowRight size={13} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Platform & Transparency Notice */}
      <div className="help-platform-card">
        <div className="help-platform-title-row">
          <Shield size={18} className="help-category-icon" aria-hidden="true" />
          <h3 className="help-platform-title">About ProductVault</h3>
          <span className="help-platform-badge">Open Prototype</span>
        </div>
        <p className="help-platform-desc">
          ProductVault is a personal product ownership assistant designed to help consumers track purchase warranties, monitor price drops, and prepare verifiable claim evidence. If you notice an issue or wish to explore technical documentation, refer to the repository documentation in the project workspace.
        </p>
      </div>
    </section>
  );
}
