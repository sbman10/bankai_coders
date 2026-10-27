"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState } from "react";
import { useGreeting } from "@/lib/time/useGreeting";
import { TechHeading } from "../TechText";
import {
  Calendar,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";

export type ProductCardItem = {
  id: string;
  name: string;
  brand: string;
  category: "Electronics" | "Appliances" | "Personal Care" | "Accessories";
  statusText: string;
  statusKind: "warranty-active" | "renew-soon" | "restock-soon" | "amc-active" | "added-manually";
  addedDate: string;
  documentCount: number;
  imageSrc: string;
  serialNumber: string;
  price: string;
  warrantyEnd: string;
  invoiceName: string;
  supportLink?: string;
};

export const masterDashboardProducts: ProductCardItem[] = [
  {
    id: "sony-wh1000xm5",
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Electronics",
    statusText: "Warranty Active",
    statusKind: "warranty-active",
    addedDate: "Added 12 Feb 2026",
    documentCount: 3,
    imageSrc: "/products/sony_wh1000xm5.png",
    serialNumber: "SN-9482018402",
    price: "₹26,990",
    warrantyEnd: "12 Feb 2027",
    invoiceName: "Sony_Invoice_Reliance.pdf",
    supportLink: "https://www.sony.co.in/electronics/support",
  },
  {
    id: "lg-refrigerator",
    name: "LG Refrigerator",
    brand: "LG Electronics",
    category: "Appliances",
    statusText: "Renew in 14 days",
    statusKind: "renew-soon",
    addedDate: "Added 12 Feb 2026",
    documentCount: 4,
    imageSrc: "/products/lg_refrigerator.png",
    serialNumber: "SN-LG-REF-59210",
    price: "₹48,500",
    warrantyEnd: "04 Jan 2027",
    invoiceName: "LG_DoubleDoor_Invoice.pdf",
    supportLink: "https://www.lg.com/in/support",
  },
  {
    id: "minimalist-sunscreen",
    name: "Minimalist Sunscreen",
    brand: "Minimalist",
    category: "Personal Care",
    statusText: "Restock Soon",
    statusKind: "restock-soon",
    addedDate: "Added 22 Nov 2025",
    documentCount: 2,
    imageSrc: "/products/minimalist_sunscreen.png",
    serialNumber: "LOT-2025-11-MIN",
    price: "₹399",
    warrantyEnd: "22 Nov 2026",
    invoiceName: "Minimalist_Order_Receipt.pdf",
    supportLink: "https://beminimalist.co/pages/contact-us",
  },
  {
    id: "titan-watch",
    name: "Titan Watch",
    brand: "Titan",
    category: "Accessories",
    statusText: "Warranty Active",
    statusKind: "warranty-active",
    addedDate: "Added 18 Aug 2025",
    documentCount: 3,
    imageSrc: "/products/titan_watch.png",
    serialNumber: "SN-TITAN-88319",
    price: "₹8,495",
    warrantyEnd: "18 Aug 2026",
    invoiceName: "Titan_Warranty_Card.pdf",
    supportLink: "https://www.titan.co.in/customer-service",
  },
  {
    id: "macbook-air-m3",
    name: "MacBook Air M3",
    brand: "Apple",
    category: "Electronics",
    statusText: "AMC Active",
    statusKind: "amc-active",
    addedDate: "Added 12 Oct 2026",
    documentCount: 5,
    imageSrc: "/products/macbook_air_m3.png",
    serialNumber: "SN-C02XYZ123ABC",
    price: "₹1,24,900",
    warrantyEnd: "10 Apr 2027",
    invoiceName: "Apple_Store_Invoice.pdf",
    supportLink: "https://support.apple.com/mac",
  },
  {
    id: "nike-air-max-270",
    name: "Nike Air Max 270",
    brand: "Nike",
    category: "Accessories",
    statusText: "Added Manually",
    statusKind: "added-manually",
    addedDate: "Added 28 Oct 2026",
    documentCount: 1,
    imageSrc: "/products/nike_air_max_270.png",
    serialNumber: "SN-NK-270-4912",
    price: "₹13,995",
    warrantyEnd: "28 Oct 2027",
    invoiceName: "Nike_Order_Confirmation.pdf",
    supportLink: "https://www.nike.com/in/help",
  },
  {
    id: "iphone-15",
    name: "iPhone 15",
    brand: "Apple",
    category: "Electronics",
    statusText: "Added Manually",
    statusKind: "added-manually",
    addedDate: "Added 03 Jan 2026",
    documentCount: 4,
    imageSrc: "/products/iphone_15.png",
    serialNumber: "SN-F2LXYZ99101",
    price: "₹79,900",
    warrantyEnd: "03 Jan 2027",
    invoiceName: "Apple_India_Tax_Invoice.pdf",
    supportLink: "https://support.apple.com/iphone",
  },
  {
    id: "office-chair",
    name: "Office Chair",
    brand: "Featherlite",
    category: "Accessories",
    statusText: "Added Manually",
    statusKind: "added-manually",
    addedDate: "Added 12 Nov 2026",
    documentCount: 2,
    imageSrc: "/products/office_chair.png",
    serialNumber: "SN-STEEL-CHAIR-19",
    price: "₹14,500",
    warrantyEnd: "12 Nov 2027",
    invoiceName: "Featherlite_Invoice.pdf",
    supportLink: "https://featherlitefurniture.com/contact-us",
  },
];

type TodayTaskItem = {
  id: string;
  productName: string;
  actionTitle: string;
  actionColor: "red" | "amber" | "gray";
  dueText: string;
  dueKind: "red" | "amber" | "gray";
  btnText: string;
  btnAction: "products" | "reminders";
  imageSrc: string;
  done: boolean;
};

const initialTodayTasks: TodayTaskItem[] = [
  {
    id: "today-1",
    productName: "LG Refrigerator",
    actionTitle: "AMC renewal due",
    actionColor: "red",
    dueText: "Due in 14 days",
    dueKind: "red",
    btnText: "View",
    btnAction: "products",
    imageSrc: "/products/lg_refrigerator.png",
    done: false,
  },
  {
    id: "today-2",
    productName: "Minimalist Sunscreen",
    actionTitle: "Estimated to restock",
    actionColor: "amber",
    dueText: "Due in 8 days",
    dueKind: "amber",
    btnText: "Set Reminder",
    btnAction: "reminders",
    imageSrc: "/products/minimalist_sunscreen.png",
    done: false,
  },
  {
    id: "today-3",
    productName: "Titan Watch",
    actionTitle: "Warranty check",
    actionColor: "gray",
    dueText: "Due in 1 month",
    dueKind: "gray",
    btnText: "View Details",
    btnAction: "products",
    imageSrc: "/products/titan_watch.png",
    done: false,
  },
];

type MasterTimelineEntry = {
  id: string;
  day: string;
  month: string;
  dotColor: string;
  section?: "Upcoming" | "Later";
  title: string;
  subtitle: string;
  badgeText: string;
  badgeKind: "red" | "amber" | "gray" | "blue";
  imageSrc: string;
};

const masterTimelineData: MasterTimelineEntry[] = [
  {
    id: "tl-1",
    section: "Upcoming",
    day: "28",
    month: "Oct",
    dotColor: "#EF4444",
    title: "LG Refrigerator",
    subtitle: "AMC renewal due",
    badgeText: "14 days",
    badgeKind: "red",
    imageSrc: "/products/lg_refrigerator.png",
  },
  {
    id: "tl-2",
    day: "02",
    month: "Nov",
    dotColor: "#F59E0B",
    title: "Minimalist Sunscreen",
    subtitle: "Time to restock",
    badgeText: "8 days",
    badgeKind: "amber",
    imageSrc: "/products/minimalist_sunscreen.png",
  },
  {
    id: "tl-3",
    day: "15",
    month: "Nov",
    dotColor: "#94A3B8",
    title: "Titan Watch",
    subtitle: "Warranty check reminder",
    badgeText: "1 month",
    badgeKind: "gray",
    imageSrc: "/products/titan_watch.png",
  },
  {
    id: "tl-4",
    section: "Later",
    day: "03",
    month: "Dec",
    dotColor: "#3B82F6",
    title: "Sony WH-1000XM5",
    subtitle: "Price target check",
    badgeText: "Tracking",
    badgeKind: "blue",
    imageSrc: "/products/sony_wh1000xm5.png",
  },
  {
    id: "tl-5",
    day: "12",
    month: "Jan",
    dotColor: "#334155",
    title: "MacBook Air M3",
    subtitle: "Service reminder",
    badgeText: "2 months",
    badgeKind: "gray",
    imageSrc: "/products/macbook_air_m3.png",
  },
  {
    id: "tl-6",
    day: "28",
    month: "Feb",
    dotColor: "#334155",
    title: "Office Chair",
    subtitle: "Recheck screws",
    badgeText: "4 months",
    badgeKind: "gray",
    imageSrc: "/products/office_chair.png",
  },
  {
    id: "tl-7",
    day: "15",
    month: "Mar",
    dotColor: "#94A3B8",
    title: "Sony WH-1000XM5",
    subtitle: "Warranty expiry",
    badgeText: "4 months",
    badgeKind: "gray",
    imageSrc: "/products/sony_wh1000xm5.png",
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
}: DashboardHomeProps) {
  const greeting = useGreeting();
  const [tasks, setTasks] = useState<TodayTaskItem[]>(initialTodayTasks);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<ProductCardItem | null>(null);

  // Scroll-linked beam progress for dashboard timeline rail
  const dashboardScrollRef = useRef<HTMLDivElement>(null);
  const [dashboardBeamProgress, setDashboardBeamProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleDashboardScroll() {
    const el = dashboardScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setDashboardBeamProgress(0);
      return;
    }
    const progress = Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100));
    setDashboardBeamProgress(progress);
  }

  // Dynamic pending tasks count
  const pendingCount = tasks.filter((t) => !t.done).length;
  const allDone = pendingCount === 0;

  function handleToggleTask(taskId: string) {
    setTasks((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, done: !item.done } : item))
    );
  }

  function handleToggleAllDone() {
    const nextState = !allDone;
    setTasks((prev) => prev.map((item) => ({ ...item, done: nextState })));
  }

  const filteredProducts = masterDashboardProducts.filter((product) => {
    if (selectedCategory === "All") return true;
    return product.category === selectedCategory;
  });

  return (
    <div className="ownership-workspace-root">
      {/* Sunlit Minimalist Interior Photograph — Scoped Exclusively to Dashboard */}
      <div className="dashboard-bg-system" aria-hidden="true">
        <div className="dashboard-bg-image" />
      </div>

      {/* Hidden accessible title for tests and screen readers */}
      <h2 className="sr-only">Make the next step feel simple.</h2>

      {/* Main Two-Column Composition */}
      <div className="ownership-main-layout">
        {/* Left Column (~925px wide) */}
        <div className="ownership-left-col">
          {/* Welcome Hero Area */}
          <section className="ownership-hero-row" aria-label="Welcome greeting">
            <div className="hero-copy-block">
              <TechHeading
                variant="page"
                as="h1"
                text={greeting.text}
                fontSize={34}
                height={50}
                className="hero-greeting-heading"
                suffix={
                  <span
                    className={greeting.emoji === "👋" ? "wave-hand" : "welcome-emoji"}
                    role="img"
                    aria-label={greeting.emojiLabel}
                  >
                    {greeting.emoji}
                  </span>
                }
              />
              <p className="hero-brand-tagline">
                <span className="tagline-static">The things you own.</span>{" "}
                <span className="tagline-spotlight">The details you forget.</span>
              </p>
            </div>

            {/* Handwritten Signature Editorial Note */}
            <div className="handwritten-brand-note" aria-hidden="true">
              <div className="handwritten-lines">
                <span>Keep</span>
                <span>Your Products</span>
                <span>Taken Care Of.</span>
              </div>
              <svg
                className="handwritten-flourish-svg"
                viewBox="0 0 120 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 12 C35 3, 85 4, 116 11"
                  stroke="#EA580C"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path
                  d="M72 13 C92 8, 108 9, 115 12"
                  stroke="#F97316"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              </svg>
            </div>
          </section>

          {/* Today Action Panel */}
          <section className="today-action-card" aria-labelledby="today-card-title">
            <div className="today-card-header">
              <div className="today-title-group">
                <TechHeading
                  variant="section"
                  as="h2"
                  id="today-card-title"
                  className="today-card-heading"
                  text="Today"
                  fontSize={20}
                  height={32}
                  suffix={<span className="today-count-paren">({pendingCount})</span>}
                />
                <div className="today-date-pill">
                  <Calendar size={13} className="date-pill-icon" />
                  <span>Tue, 28 Oct 2026</span>
                </div>
              </div>

              <button
                type="button"
                className="mark-all-done-btn"
                onClick={handleToggleAllDone}
                aria-label={allDone ? "Unmark all done" : "Mark all done"}
              >
                <span className="mark-all-label">Mark all done</span>
                <span className={`custom-checkbox-box ${allDone ? "checked" : ""}`}>
                  {allDone && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            </div>

            {/* Today Action Rows */}
            <div className="today-action-list" role="list">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`today-action-row ${task.done ? "is-done" : ""}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className={`row-checkbox-btn ${task.done ? "checked" : ""}`}
                    onClick={() => handleToggleTask(task.id)}
                    aria-label={`Mark ${task.productName} action complete`}
                  >
                    {task.done && <Check size={12} strokeWidth={3} />}
                  </button>

                  <div className="today-row-thumb">
                    <img src={task.imageSrc} alt="" className="today-row-product-img" />
                  </div>

                  <div className="today-row-info">
                    <strong className="today-product-name">{task.productName}</strong>
                    <span className={`today-action-status status-${task.actionColor}`}>
                      {task.actionTitle}
                    </span>
                  </div>

                  <div className="today-row-actions">
                    <span className={`due-badge due-badge-${task.dueKind}`}>
                      {task.dueText}
                    </span>
                    <button
                      type="button"
                      className="today-contextual-btn"
                      onClick={() => onNavigateTab(task.btnAction)}
                    >
                      <span>{task.btnText}</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Your Products Collection */}
          <section className="your-products-section" aria-labelledby="products-section-title">
            <div className="products-section-header">
              <TechHeading
                variant="section"
                as="h2"
                id="products-section-title"
                className="products-section-heading"
                text="Your Products"
                fontSize={22}
                height={36}
                suffix={<span className="products-count-num">(12)</span>}
              />

              <div className="products-filter-strip">
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "All" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("All")}
                >
                  All (12)
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Electronics" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Electronics")}
                >
                  Electronics (5)
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Appliances" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Appliances")}
                >
                  Appliances (2)
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Personal Care" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Personal Care")}
                >
                  Personal Care (3)
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Accessories" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Accessories")}
                >
                  Accessories (2)
                </button>
                <button
                  type="button"
                  className="category-add-btn"
                  onClick={() => onNavigateTab("products")}
                  aria-label="Add category filter"
                  title="Add category filter"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* View Toggle */}
              <div className="products-view-toggle">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            {/* 4-Column Product Grid */}
            <div
              className={`products-container-layout ${
                viewMode === "grid" ? "quad-grid" : "list-layout"
              }`}
            >
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="product-card-ref"
                  onClick={() => setSelectedProduct(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedProduct(product);
                    }
                  }}
                >
                  {/* Top Row: Status pill & 3-dot menu */}
                  <div className="product-card-top-row">
                    <span className={`status-pill ${product.statusKind}`}>
                      {product.statusText}
                    </span>
                    <button
                      type="button"
                      className="product-menu-dots-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(product);
                      }}
                      aria-label={`Options for ${product.name}`}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>

                  {/* Centered Product Visual - Realistic Clean Cutout */}
                  <div className="product-visual-stage">
                    <img
                      src={product.imageSrc}
                      alt={product.name}
                      className="product-cutout-img"
                      loading="eager"
                    />
                  </div>

                  {/* Name and Added Date */}
                  <div className="product-info-block">
                    <strong className="product-name-title">{product.name}</strong>
                    <span className="product-added-date">{product.addedDate}</span>
                  </div>

                  {/* Bottom Strip: Documents count and Arrow */}
                  <div className="product-card-footer">
                    <div className="doc-count-strip">
                      <FileText size={12} className="doc-strip-icon" />
                      <span>{product.documentCount} {product.documentCount === 1 ? "document" : "documents"}</span>
                    </div>
                    <ChevronRight size={14} className="card-footer-arrow" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column (~460px wide) */}
        <div className="ownership-right-col">
          {/* Timeline Card */}
          <section className="timeline-widget-card" aria-labelledby="timeline-card-title">
            <div className="timeline-widget-header">
              <div className="timeline-title-wrap">
                <Calendar size={16} className="timeline-header-icon" />
                <TechHeading
                  variant="section"
                  as="h2"
                  id="timeline-card-title"
                  className="timeline-widget-heading"
                  text="Your Timeline"
                  fontSize={20}
                  height={32}
                />
              </div>
              <button
                type="button"
                className="timeline-view-all-btn"
                onClick={onOpenReview}
                aria-label="Open full review"
              >
                <span>View All</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Scrollable Timeline Events */}
            <div
              className="timeline-events-scroll-container"
              ref={dashboardScrollRef}
              onScroll={handleDashboardScroll}
            >
              <div className="timeline-vertical-spine" suppressHydrationWarning>
                {mounted && (
                  <div
                    className="timeline-vertical-spine-beam"
                    style={{ height: `${dashboardBeamProgress}%` }}
                    aria-hidden="true"
                    suppressHydrationWarning
                  />
                )}
              </div>

              <div className="timeline-items-flow">
                {masterTimelineData.map((item) => (
                  <React.Fragment key={item.id}>
                    {item.section && (
                      <div className="timeline-section-divider">
                        <span className="section-pill-tag">{item.section}</span>
                      </div>
                    )}
                    <div className="timeline-event-row">
                      <div className="event-date-col">
                        <span className="event-day-number">{item.day}</span>
                        <span className="event-month-text">{item.month}</span>
                      </div>

                      <div
                        className="event-node-dot"
                        style={{ backgroundColor: item.dotColor }}
                      />

                      <div className="event-thumb-wrap">
                        <img src={item.imageSrc} alt="" className="timeline-event-thumb-img" />
                      </div>

                      <div className="event-desc-col">
                        <strong className="event-item-title">{item.title}</strong>
                        <span className="event-item-sub">{item.subtitle}</span>
                      </div>

                      <div className="event-badge-col">
                        <span className={`timeline-badge badge-${item.badgeKind}`}>
                          {item.badgeText}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </section>

          {/* Bottom-Right Add Product CTA Card */}
          <section className="add-product-cta-card" aria-label="Add a product CTA">
            <div className="cta-content-side">
              <div className="cta-header-row">
                <span className="cta-bulb-icon" role="img" aria-label="Lightbulb">💡</span>
                <h3 className="cta-heading-text">Add a product in seconds</h3>
              </div>
              <p className="cta-desc-text">
                Just paste an Amazon, Flipkart or Meesho link and we&apos;ll create your product passport.
              </p>
            </div>

            <div className="cta-action-side">
              {/* Hand-drawn curved arrow SVG */}
              <svg
                className="cta-hand-drawn-arrow"
                viewBox="0 0 60 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M10 32 C18 10, 42 8, 52 24"
                  stroke="#1C1917"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M45 25 L52 24 L52 17"
                  stroke="#1C1917"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <button
                type="button"
                className="add-product-black-btn"
                onClick={() => onNavigateTab("add-product")}
                aria-label="Add Product"
              >
                + Add Product
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Product Passport Detail Modal */}
      {selectedProduct && (
        <div
          className="passport-modal-overlay"
          onClick={() => setSelectedProduct(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="passport-modal-title"
        >
          <div
            className="passport-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="passport-modal-head">
              <div className="passport-head-left">
                <div className="passport-modal-thumb">
                  <img
                    src={selectedProduct.imageSrc}
                    alt={selectedProduct.name}
                    className="passport-cutout-img"
                  />
                </div>
                <div>
                  <div className="passport-brand-tag">{selectedProduct.brand}</div>
                  <h3 id="passport-modal-title" className="passport-product-title">
                    {selectedProduct.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                className="passport-close-btn"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close passport"
              >
                <X size={18} />
              </button>
            </div>

            <div className="passport-modal-body">
              <div className="passport-details-grid">
                <div className="passport-field">
                  <span className="field-label">Category</span>
                  <span className="field-value font-medium">{selectedProduct.category}</span>
                </div>
                <div className="passport-field">
                  <span className="field-label">Status</span>
                  <span className={`status-pill ${selectedProduct.statusKind}`}>
                    {selectedProduct.statusText}
                  </span>
                </div>
                <div className="passport-field">
                  <span className="field-label">Serial Number</span>
                  <span className="field-value font-mono">{selectedProduct.serialNumber}</span>
                </div>
                <div className="passport-field">
                  <span className="field-label">Purchase Price</span>
                  <span className="field-value font-semibold">{selectedProduct.price}</span>
                </div>
                <div className="passport-field">
                  <span className="field-label">Warranty Valid Until</span>
                  <span className="field-value">{selectedProduct.warrantyEnd}</span>
                </div>
              </div>

              {/* Saved Document Card */}
              <div className="passport-document-card">
                <div className="doc-card-info">
                  <FileText size={18} className="doc-icon" />
                  <div>
                    <strong>{selectedProduct.invoiceName}</strong>
                    <span className="doc-meta">Verified Purchase Invoice · PDF</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="doc-download-btn"
                  onClick={() => alert(`Opening ${selectedProduct.invoiceName}`)}
                >
                  <Download size={14} />
                  <span>View</span>
                </button>
              </div>

              {/* Official Support Link */}
              {selectedProduct.supportLink && (
                <div className="passport-support-row">
                  <span className="support-label">Official Manufacturer Support</span>
                  <a
                    href={selectedProduct.supportLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="support-link"
                  >
                    <span>Visit Support Portal</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="passport-modal-actions">
                <button
                  type="button"
                  className="passport-claim-btn"
                  onClick={() => {
                    setSelectedProduct(null);
                    onStartClaim();
                  }}
                >
                  <span>Claim Under Warranty</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="passport-timeline-btn"
                  onClick={() => {
                    setSelectedProduct(null);
                    onNavigateTab("timeline");
                  }}
                >
                  <span>View in Timeline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
