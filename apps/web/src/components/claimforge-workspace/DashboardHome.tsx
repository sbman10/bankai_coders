"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Package,
  Plus,
  Shield,
  ShieldCheck,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  HeadphoneThumb,
  HeroBoxIllustration,
  LaptopThumb,
  RefrigeratorThumb,
  SneakerThumb,
  SunscreenThumb,
  WatchThumb,
} from "./ProductVisuals";

export type ProductDetail = {
  id: string;
  name: string;
  brand: string;
  category: string;
  purchaseDate: string;
  warrantyEnd: string;
  warrantyStatus: "Active Warranty" | "AMC Active" | "Expires Soon" | "Track Refill";
  invoiceName: string;
  serialNumber: string;
  price: string;
  thumb: React.ReactNode;
  attentionNote?: string;
};

export const sampleProducts: ProductDetail[] = [
  {
    id: "sony-wh1000xm5",
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Electronics",
    purchaseDate: "12 Feb 2026",
    warrantyEnd: "12 Feb 2027",
    warrantyStatus: "Active Warranty",
    invoiceName: "Sony_Invoice_Reliance.pdf",
    serialNumber: "SN-9482018402",
    price: "₹26,990",
    thumb: <HeadphoneThumb className="w-12 h-12" />,
    attentionNote: "Warranty card on file · Terms verified",
  },
  {
    id: "lg-refrigerator",
    name: "LG Refrigerator",
    brand: "LG Electronics",
    category: "Appliances",
    purchaseDate: "04 Jan 2026",
    warrantyEnd: "04 Jan 2027",
    warrantyStatus: "AMC Active",
    invoiceName: "LG_DoubleDoor_Invoice.pdf",
    serialNumber: "SN-LG-REF-59210",
    price: "₹48,500",
    thumb: <RefrigeratorThumb className="w-12 h-12" />,
    attentionNote: "AMC renewal due in 14 days",
  },
  {
    id: "titan-watch",
    name: "Titan Analog Watch",
    brand: "Titan",
    category: "Accessories",
    purchaseDate: "18 Aug 2025",
    warrantyEnd: "18 Aug 2026",
    warrantyStatus: "Expires Soon",
    invoiceName: "Titan_Warranty_Card.pdf",
    serialNumber: "SN-TITAN-88319",
    price: "₹8,495",
    thumb: <WatchThumb className="w-12 h-12" />,
    attentionNote: "Warranty expires in 21 days (18 Aug 2026)",
  },
  {
    id: "minimalist-sunscreen",
    name: "Minimalist Sunscreen",
    brand: "Minimalist",
    category: "Personal Care",
    purchaseDate: "22 Nov 2025",
    warrantyEnd: "N/A (Refill Cycle)",
    warrantyStatus: "Track Refill",
    invoiceName: "Minimalist_Order_Receipt.pdf",
    serialNumber: "LOT-2025-11-MIN",
    price: "₹399",
    thumb: <SunscreenThumb className="w-12 h-12" />,
    attentionNote: "Estimated to restock in 8 days based on usage",
  },
  {
    id: "macbook-air-m3",
    name: "MacBook Air 15\" M3",
    brand: "Apple",
    category: "Computers",
    purchaseDate: "10 Apr 2026",
    warrantyEnd: "10 Apr 2027",
    warrantyStatus: "Active Warranty",
    invoiceName: "Apple_Store_Invoice.pdf",
    serialNumber: "SN-C02XYZ123ABC",
    price: "₹1,24,900",
    thumb: <LaptopThumb className="w-12 h-12" />,
    attentionNote: "Confirm warranty registration link",
  },
];

type TimelineItem = {
  id: string;
  date: string;
  dotColor: string;
  title: string;
  action: string;
  subtext: string;
  category: string;
  thumb: React.ReactNode;
};

const timelineEvents: TimelineItem[] = [
  {
    id: "t6",
    date: "28 Oct 2026",
    dotColor: "#4338CA",
    title: "Nike Air Max 270",
    action: "Added to price watch",
    subtext: "Target: ₹7,499 · Target Reached",
    category: "Footwear",
    thumb: <SneakerThumb className="w-7 h-7" />,
  },
  {
    id: "t5",
    date: "12 Oct 2026",
    dotColor: "#3B82F6",
    title: "MacBook Air 15\" M3",
    action: "Purchased",
    subtext: "Apple Store BKC invoice saved",
    category: "Electronics",
    thumb: <LaptopThumb className="w-7 h-7" />,
  },
  {
    id: "t4",
    date: "10 Sep 2026",
    dotColor: "#B45309",
    title: "Titan Watch",
    action: "Warranty card added",
    subtext: "Official service support link saved",
    category: "Accessories",
    thumb: <WatchThumb className="w-7 h-7" />,
  },
  {
    id: "t3",
    date: "20 Jun 2026",
    dotColor: "#F59E0B",
    title: "LG Refrigerator",
    action: "AMC registered",
    subtext: "Annual service plan saved",
    category: "Appliances",
    thumb: <RefrigeratorThumb className="w-7 h-7" />,
  },
  {
    id: "t2",
    date: "02 May 2026",
    dotColor: "#F97316",
    title: "Minimalist Sunscreen",
    action: "Passport created",
    subtext: "60-day refill reminder scheduled",
    category: "Personal Care",
    thumb: <SunscreenThumb className="w-7 h-7" />,
  },
  {
    id: "t1",
    date: "15 Mar 2026",
    dotColor: "#EF4444",
    title: "Sony WH-1000XM5",
    action: "Purchased",
    subtext: "Reliance Digital invoice saved",
    category: "Electronics",
    thumb: <HeadphoneThumb className="w-7 h-7" />,
  },
];

interface DashboardHomeProps {
  onStartClaim: () => void;
  onOpenReview: () => void;
  onNavigateTab: (tab: string) => void;
  isDarkTheme?: boolean;
}

export function DashboardHome({
  onStartClaim,
  onOpenReview,
  onNavigateTab,
  isDarkTheme = false,
}: DashboardHomeProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>("All");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const filteredTimeline = timelineEvents.filter((item) => {
    if (timelineFilter === "All") return true;
    return item.category === timelineFilter;
  });

  return (
    <div className="dashboard-layout">
      {/* Hidden accessible title for tests and assistive technology */}
      <h2 className="sr-only">Make the next step feel simple.</h2>

      {/* Main Center Content */}
      <div className="dashboard-center">
        {/* Welcome Greeting Banner */}
        <section className="welcome-banner" aria-label="Welcome greeting">
          <div className="welcome-copy">
            <h1 className="welcome-heading">
              {isDarkTheme ? "Good evening, Rohan" : "Good morning, Rohan"}{" "}
              <span className="wave-hand" role="img" aria-label="Waving hand">👋</span>
            </h1>
            <p className="welcome-subtext">
              Here&apos;s everything about your products. Your documents. Your next steps.
            </p>
          </div>
          <div className="welcome-illustration">
            <HeroBoxIllustration className="welcome-box-svg" />
          </div>
        </section>

        {/* 4 Top KPI / Metric Cards */}
        <div className="kpi-grid" role="region" aria-label="Key Performance Indicators">
          {/* Card 1: Total Products */}
          <div className="kpi-card" onClick={() => onNavigateTab("products")}>
            <div className="kpi-icon-wrap kpi-icon-orange">
              <Package size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-value">12</span>
              <span className="kpi-label">Total Products</span>
              <span className="kpi-badge kpi-badge-green">
                <TrendingUp size={12} /> +2 this month
              </span>
            </div>
          </div>

          {/* Card 2: Upcoming Actions */}
          <div className="kpi-card" onClick={() => onNavigateTab("reminders")}>
            <div className="kpi-icon-wrap kpi-icon-orange-light">
              <Bell size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-value">3</span>
              <span className="kpi-label">Upcoming Actions</span>
              <span className="kpi-subtext">Next in 5 days</span>
            </div>
          </div>

          {/* Card 3: Price Watches */}
          <div className="kpi-card" onClick={() => onNavigateTab("prices")}>
            <div className="kpi-icon-wrap kpi-icon-blue">
              <Tag size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-value">2</span>
              <span className="kpi-label">Price Watches</span>
              <span className="kpi-badge kpi-badge-green">1 price drop today</span>
            </div>
          </div>

          {/* Card 4: Active Warranties */}
          <div className="kpi-card" onClick={() => onNavigateTab("claims")}>
            <div className="kpi-icon-wrap kpi-icon-green">
              <ShieldCheck size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-value">5</span>
              <span className="kpi-label">Active Warranties</span>
              <span className="kpi-subtext text-amber">2 expiring soon</span>
            </div>
          </div>
        </div>

        {/* Middle Row: Two Columns (Needs Attention & Price Drop Alerts) */}
        <div className="dashboard-middle-grid">
          {/* Column 1: Needs Your Attention */}
          <section className="dash-card attention-card" aria-labelledby="needs-attention-heading">
            <div className="dash-card-header">
              <div className="dash-card-title">
                <span className="attention-header-icon">
                  <AlertTriangle size={18} />
                </span>
                <h3 id="needs-attention-heading">Needs Your Attention</h3>
              </div>
              <button
                className="view-all-link"
                onClick={onOpenReview}
                aria-label="Open full review"
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            <div className="attention-list">
              {/* Item 1: LG Refrigerator */}
              <div
                className="attention-item"
                onClick={() => onNavigateTab("reminders")}
                role="button"
                tabIndex={0}
              >
                <div className="attention-thumb">
                  <RefrigeratorThumb className="w-10 h-10" />
                </div>
                <div className="attention-info">
                  <strong className="attention-product-name">LG Refrigerator</strong>
                  <span className="attention-tag-red">AMC renewal due</span>
                  <span className="attention-sub">Service plan renewal due in 14 days</span>
                </div>
                <div className="attention-action">
                  <span className="badge-pill badge-pill-red">14 days</span>
                  <ChevronRight size={15} className="item-arrow" />
                </div>
              </div>

              {/* Item 2: Titan Analog Watch */}
              <div
                className="attention-item"
                onClick={() => onNavigateTab("products")}
                role="button"
                tabIndex={0}
              >
                <div className="attention-thumb">
                  <WatchThumb className="w-10 h-10" />
                </div>
                <div className="attention-info">
                  <strong className="attention-product-name">Titan Analog Watch</strong>
                  <span className="attention-tag-amber">Warranty expiring soon</span>
                  <span className="attention-sub">Expires in 21 days (18 Aug 2026)</span>
                </div>
                <div className="attention-action">
                  <span className="badge-pill badge-pill-amber">21 days</span>
                  <ChevronRight size={15} className="item-arrow" />
                </div>
              </div>

              {/* Item 3: Minimalist Sunscreen */}
              <div
                className="attention-item"
                onClick={() => onNavigateTab("reminders")}
                role="button"
                tabIndex={0}
              >
                <div className="attention-thumb">
                  <SunscreenThumb className="w-10 h-10" />
                </div>
                <div className="attention-info">
                  <strong className="attention-product-name">Minimalist Sunscreen</strong>
                  <span className="attention-tag-amber">Replenishment reminder</span>
                  <span className="attention-sub">Refill needed in 8 days based on usage</span>
                </div>
                <div className="attention-action">
                  <span className="badge-pill badge-pill-amber">8 days</span>
                  <ChevronRight size={15} className="item-arrow" />
                </div>
              </div>

              {/* Item 4: MacBook Air 15" M3 */}
              <div
                className="attention-item"
                onClick={() => onNavigateTab("products")}
                role="button"
                tabIndex={0}
              >
                <div className="attention-thumb">
                  <LaptopThumb className="w-10 h-10" />
                </div>
                <div className="attention-info">
                  <strong className="attention-product-name">MacBook Air 15&quot; M3</strong>
                  <span className="attention-tag-blue">Confirm product details</span>
                  <span className="attention-sub">Upload warranty card or official support URL</span>
                </div>
                <div className="attention-action">
                  <span className="badge-pill badge-pill-blue">Needs Info</span>
                  <ChevronRight size={15} className="item-arrow" />
                </div>
              </div>
            </div>
          </section>

          {/* Column 2: Price Drop Alerts */}
          <section className="dash-card price-alerts-card" aria-labelledby="price-drop-heading">
            <div className="dash-card-header">
              <div className="dash-card-title">
                <span className="price-header-icon">
                  <TrendingDown size={18} />
                </span>
                <h3 id="price-drop-heading">Price Drop Alerts</h3>
              </div>
              <button
                className="view-all-link"
                onClick={() => onNavigateTab("prices")}
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            <div className="price-alerts-list">
              {/* Alert 1: Sony WH-1000XM5 */}
              <div
                className="price-alert-item"
                onClick={() => onNavigateTab("prices")}
                role="button"
                tabIndex={0}
              >
                <div className="price-alert-thumb">
                  <HeadphoneThumb className="w-10 h-10" />
                </div>
                <div className="price-alert-info">
                  <strong className="price-product-name">Sony WH-1000XM5</strong>
                  <span className="price-sub">
                    Prev: <s>₹26,990</s> · Current: <strong>₹24,990</strong> · Target: ₹22,000
                  </span>
                  <span className="price-meta-text">
                    Checked 3h ago · Amazon India (Above target by ₹2,990)
                  </span>
                </div>
                <div className="price-alert-action">
                  <span className="badge-pill badge-pill-green badge-dropped">
                    ↓ ₹2,000 dropped
                  </span>
                </div>
              </div>

              {/* Alert 2: Nike Air Max 270 */}
              <div
                className="price-alert-item"
                onClick={() => onNavigateTab("prices")}
                role="button"
                tabIndex={0}
              >
                <div className="price-alert-thumb">
                  <SneakerThumb className="w-10 h-10" />
                </div>
                <div className="price-alert-info">
                  <strong className="price-product-name">Nike Air Max 270</strong>
                  <span className="price-sub">
                    Prev: <s>₹7,999</s> · Current: <strong>₹7,499</strong> · Target: ₹7,499
                  </span>
                  <span className="price-meta-text">
                    Checked today · Nike Store India
                  </span>
                </div>
                <div className="price-alert-action">
                  <span className="badge-pill badge-pill-green badge-target-reached">
                    🎯 Target Reached!
                  </span>
                </div>
              </div>

              {/* Alert 3: Apple MacBook Air 15" M3 */}
              <div
                className="price-alert-item"
                onClick={() => onNavigateTab("prices")}
                role="button"
                tabIndex={0}
              >
                <div className="price-alert-thumb">
                  <LaptopThumb className="w-10 h-10" />
                </div>
                <div className="price-alert-info">
                  <strong className="price-product-name">MacBook Air 15&quot; M3</strong>
                  <span className="price-sub">
                    Prev: <s>₹1,29,900</s> · Current: <strong>₹1,24,900</strong> · Target: ₹1,15,000
                  </span>
                  <span className="price-meta-text">
                    Checked yesterday · Apple BKC (Above target by ₹9,900)
                  </span>
                </div>
                <div className="price-alert-action">
                  <span className="badge-pill badge-pill-green badge-dropped">
                    ↓ ₹5,000 dropped
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Claim Draft Strip */}
        <section className="draft-strip" aria-label="Claim draft status">
          <div className="draft-icon">
            <FileText size={20} />
          </div>
          <div className="draft-copy">
            <span className="draft-kicker">READY WHEN YOU ARE</span>
            <strong className="draft-title">Your claim draft for Auralis Pulse 2 is ready to review.</strong>
            <small className="draft-note">Nothing is sent until you explicitly approve it.</small>
          </div>
          <button
            className="button button-dark review-draft-btn"
            onClick={onOpenReview}
            aria-label="Review claim"
          >
            Review claim <ArrowRight size={14} />
          </button>
        </section>

        {/* Quick Actions Row */}
        <section className="quick-actions-section" aria-label="Quick Actions">
          <h3 className="section-title">Quick Actions</h3>
          <div className="quick-actions-grid">
            {/* 1. Add a Product */}
            <button
              className="quick-action-btn"
              onClick={() => onNavigateTab("products")}
              aria-label="Add a Product"
            >
              <div className="qa-icon-wrap qa-icon-orange">
                <Plus size={18} />
              </div>
              <div className="qa-text">
                <strong>Add a Product</strong>
                <span>Upload invoice or warranty card</span>
              </div>
            </button>

            {/* 2. Watch a Price */}
            <button
              className="quick-action-btn"
              onClick={() => onNavigateTab("prices")}
              aria-label="Watch a Price"
            >
              <div className="qa-icon-wrap qa-icon-orange-light">
                <Tag size={18} />
              </div>
              <div className="qa-text">
                <strong>Watch a Price</strong>
                <span>Track your target price</span>
              </div>
            </button>

            {/* 3. Set a Reminder */}
            <button
              className="quick-action-btn"
              onClick={() => onNavigateTab("reminders")}
              aria-label="Set a Reminder"
            >
              <div className="qa-icon-wrap qa-icon-peach">
                <Bell size={18} />
              </div>
              <div className="qa-text">
                <strong>Set a Reminder</strong>
                <span>Warranty, service or refill</span>
              </div>
            </button>

            {/* 4. File a Claim */}
            <button
              className="quick-action-btn"
              onClick={onStartClaim}
              aria-label="Start a claim"
            >
              <div className="qa-icon-wrap qa-icon-coral">
                <Shield size={18} />
              </div>
              <div className="qa-text">
                <strong>File a Claim</strong>
                <span>Start a warranty claim</span>
              </div>
            </button>

            {/* 5. View Timeline */}
            <button
              className="quick-action-btn"
              onClick={() => onNavigateTab("timeline")}
              aria-label="View Timeline"
            >
              <div className="qa-icon-wrap qa-icon-sand">
                <Clock3 size={18} />
              </div>
              <div className="qa-text">
                <strong>View Timeline</strong>
                <span>See your ownership journey</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Right Column: Product Timeline */}
      <aside className="dashboard-timeline-panel" aria-label="Product Timeline">
        <div className="timeline-header">
          <div className="timeline-title-row">
            <Clock3 size={18} className="timeline-clock-icon" />
            <h3 className="timeline-heading">Product Timeline</h3>
          </div>

          <div className="timeline-filter-wrap">
            <button
              className="timeline-filter-btn"
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              aria-label="Filter products"
            >
              <span>{timelineFilter === "All" ? "All Products" : timelineFilter}</span>
              <ChevronDown size={14} />
            </button>
            {filterMenuOpen && (
              <div className="timeline-filter-menu" role="menu">
                {["All", "Electronics", "Appliances", "Accessories", "Personal Care", "Footwear"].map((cat) => (
                  <button
                    key={cat}
                    className={`filter-option ${timelineFilter === cat ? "active" : ""}`}
                    onClick={() => {
                      setTimelineFilter(cat);
                      setFilterMenuOpen(false);
                    }}
                  >
                    {cat === "All" ? "All Products" : cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="timeline-flow">
          <div className="timeline-vertical-line" />
          {filteredTimeline.map((item) => (
            <div key={item.id} className="timeline-node">
              <div className="timeline-date-col">
                <span className="node-day">{item.date.split(" ")[0]}</span>
                <span className="node-month-year">{item.date.split(" ").slice(1).join(" ")}</span>
              </div>

              <div
                className="timeline-marker-dot"
                style={{ backgroundColor: item.dotColor, borderColor: item.dotColor }}
              />

              <div className="timeline-node-card">
                <div className="node-card-visual">{item.thumb}</div>
                <div className="node-card-copy">
                  <strong className="node-product-title">{item.title}</strong>
                  <span className="node-action-text">{item.action}</span>
                  <span className="node-sub-text">{item.subtext}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Product Details Modal Dialog */}
      {selectedProduct && (
        <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <div
            className="product-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className={`product-status-tag tag-${selectedProduct.warrantyStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                  {selectedProduct.warrantyStatus}
                </span>
                <h3 id="product-modal-title">{selectedProduct.name}</h3>
                <span className="modal-brand">{selectedProduct.brand} · {selectedProduct.category}</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-visual-row">
                <div className="modal-thumb">{selectedProduct.thumb}</div>
                <div className="modal-specs">
                  <div className="spec-row">
                    <span>Serial Number:</span>
                    <strong>{selectedProduct.serialNumber}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Purchase Date:</span>
                    <strong>{selectedProduct.purchaseDate}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Warranty End:</span>
                    <strong>{selectedProduct.warrantyEnd}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Invoice on file:</span>
                    <strong className="invoice-link">
                      <FileText size={13} /> {selectedProduct.invoiceName}
                    </strong>
                  </div>
                </div>
              </div>

              {selectedProduct.attentionNote && (
                <div className="modal-alert-box">
                  <AlertTriangle size={16} />
                  <span>{selectedProduct.attentionNote}</span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-modal-claim"
                onClick={() => {
                  setSelectedProduct(null);
                  onStartClaim();
                }}
              >
                <Shield size={15} /> File Claim for this product
              </button>
              <button
                className="btn-modal-close"
                onClick={() => setSelectedProduct(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
