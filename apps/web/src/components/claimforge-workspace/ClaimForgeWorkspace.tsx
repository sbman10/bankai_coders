"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  Crown,
  FileText,
  GitCommit,
  HelpCircle,
  Home,
  LockKeyhole,
  Moon,
  Package,
  PackagePlus,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  TrendingDown,
} from "lucide-react";
import { ClaimIntake } from "./ClaimIntake";
import { ClaimReview } from "./ClaimReview";
import { DashboardHome } from "./DashboardHome";
import { AmazonImport } from "./AmazonImport";
import { ProductCenter } from "./ProductCenter";
import { ClaimsList, type SavedClaim } from "./ClaimsList";
import { AssistantChat } from "./AssistantChat";
import { ClaimForgeLogoMark } from "./ProductVisuals";
import { sampleClaim, type ClaimIntakePayload, type ClaimSubmission } from "./types";

type View =
  | "workspace"
  | "intake"
  | "review"
  | "claims"
  | "products"
  | "amazon-import"
  | "assistant"
  | "prices"
  | "reminders"
  | "timeline"
  | "settings"
  | "help";

export function ClaimForgeWorkspace() {
  const [view, setView] = useState<View>("workspace");
  const [claim, setClaim] = useState<ClaimSubmission>(sampleClaim);
  const [approved, setApproved] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("claimforge-theme") === "dark";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize theme from system or saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("claimforge-theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark");
    }

    // Keyboard shortcut for Cmd/Ctrl + K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("header-search-input");
        searchInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [claims, setClaims] = useState<SavedClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState("");

  useEffect(() => {
    if (view !== "claims") return;
    let active = true;
    fetch("/api/claims", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Couldn't load claims.");
        if (active) setClaims(result.claims ?? []);
      })
      .catch((err) => {
        if (active) setClaimsError(err instanceof Error ? err.message : "Couldn't load claims.");
      })
      .finally(() => {
        if (active) setClaimsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view]);

  function toggleTheme(newDarkState: boolean) {
    setIsDarkTheme(newDarkState);
    if (newDarkState) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark");
      localStorage.setItem("claimforge-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark");
      localStorage.setItem("claimforge-theme", "light");
    }
  }

  function beginClaim() {
    setApproved(false);
    setView("intake");
  }

  async function submitClaim(nextClaim: ClaimIntakePayload, _idempotencyKey?: string): Promise<void> {
    setApproved(false);
    setClaim({
      product: nextClaim.product,
      fault: nextClaim.fault,
      failureDate: nextClaim.failureDate,
      invoiceName: nextClaim.invoice?.name ?? "Invoice not attached",
      warrantyName: nextClaim.warranty?.name ?? "Warranty terms not attached",
      source: "local-preview",
    });
    setView("review");
  }

  return (
    <div className={`app-shell ${isDarkTheme ? "dark-theme" : "light-theme"} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Left Sidebar */}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <a className="brand" href="#home" onClick={() => setView("workspace")}>
            <ClaimForgeLogoMark className="brand-cube-logo" />
            <div className="brand-text">
              <span className="brand-name">ClaimForge</span>
              <span className="brand-tagline">Your Products. Always Covered.</span>
            </div>
          </a>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="workspace-badge-row">
          <span className="demo-pill">PUBLIC DEMO</span>
        </div>

        <nav className="nav-list" aria-label="Workspace">
          <button
            className={`nav-item ${view === "workspace" ? "active" : ""}`}
            onClick={() => setView("workspace")}
          >
            <span className="nav-icon"><Home size={17} /></span>
            <span className="nav-label">Dashboard</span>
          </button>

          <button
            className={`nav-item ${view === "products" ? "active" : ""}`}
            onClick={() => setView("products")}
            aria-label="Products"
          >
            <span className="nav-icon"><Package size={17} /></span>
            <span className="nav-label">My Products</span>
          </button>

          <button
            className={`nav-item ${view === "intake" ? "active" : ""}`}
            onClick={beginClaim}
            aria-label="Add Product"
          >
            <span className="nav-icon"><PackagePlus size={17} /></span>
            <span className="nav-label">Add Product</span>
          </button>

          <button
            className={`nav-item nav-item-amazon ${view === "amazon-import" ? "active" : ""}`}
            onClick={() => setView("amazon-import")}
            aria-label="Import from Amazon"
          >
            <span className="nav-icon nav-icon-amazon">
              <svg width="17" height="17" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M5.5 22.5C10.5 27 17.5 28.5 24 26" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M24 26L21 23.5M24 26L21.5 28.5" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="4" y="19" fontFamily="Arial" fontWeight="bold" fontSize="13" fill="currentColor">a</text>
              </svg>
            </span>
            <span className="nav-label">Import from Amazon</span>
          </button>

          <button
            className={`nav-item ${view === "assistant" ? "active" : ""}`}
            onClick={() => setView("assistant")}
            aria-label="Ask documents"
          >
            <span className="nav-icon"><FileText size={17} /></span>
            <span className="nav-label">Documents</span>
          </button>

          <button
            className={`nav-item ${view === "prices" ? "active" : ""}`}
            onClick={() => setView("prices")}
          >
            <span className="nav-icon"><TrendingDown size={17} /></span>
            <span className="nav-label">Price Watch</span>
          </button>

          <button
            className={`nav-item ${view === "reminders" ? "active" : ""}`}
            onClick={() => setView("reminders")}
          >
            <span className="nav-icon"><Bell size={17} /></span>
            <span className="nav-label">Reminders</span>
            <span className="nav-count-badge">3</span>
          </button>

          <button
            className={`nav-item ${view === "claims" || view === "review" ? "active" : ""}`}
            onClick={() => { setView("claims"); void loadClaims(); }}
          >
            <span className="nav-icon"><ShieldCheck size={17} /></span>
            <span className="nav-label">My Claims</span>
            {claims.length > 0 && <span className="nav-count-badge">{claims.length}</span>}
          </button>

          <button
            className={`nav-item ${view === "timeline" ? "active" : ""}`}
            onClick={() => setView("timeline")}
          >
            <span className="nav-icon"><GitCommit size={17} /></span>
            <span className="nav-label">Timeline</span>
          </button>

          <div className="nav-divider" />

          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <span className="nav-icon"><Settings size={17} /></span>
            <span className="nav-label">Settings</span>
          </button>

          <button
            className={`nav-item ${view === "help" ? "active" : ""}`}
            onClick={() => setView("help")}
          >
            <span className="nav-icon"><HelpCircle size={17} /></span>
            <span className="nav-label">Help &amp; Support</span>
          </button>
        </nav>

        {/* Upgrade to Pro Card */}
        <div className="sidebar-bottom">
          <div className="upgrade-pro-card">
            <div className="upgrade-icon-wrap">
              <Crown size={20} className="crown-icon" />
            </div>
            <strong className="upgrade-title">Upgrade to Pro</strong>
            <p className="upgrade-desc">
              Get advanced tracking, unlimited storage and more.
            </p>
            <button
              className="upgrade-btn"
              onClick={() => alert("ClaimForge Pro subscription preview: Unlimited document OCR, automated invoice extraction, and price alert webhook dispatching.")}
            >
              Upgrade Now <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-viewport">
        {/* Topbar */}
        <header className="topbar">
          {/* Search bar */}
          <div className={`search-container ${searchFocused ? "focused" : ""}`}>
            <Search size={16} className="search-icon" />
            <input
              id="header-search-input"
              type="search"
              className="search-input"
              placeholder="Search your products, documents, or ask anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              aria-label="Search products and documents"
            />
            <div className="search-shortcut" title="Press Ctrl+K or Cmd+K to search">
              <span className="kbd-symbol">⌘</span>
              <span>K</span>
            </div>

            {/* Quick search drop-down if typing */}
            {searchFocused && searchQuery && (
              <div className="search-popover">
                <div className="search-popover-item" onClick={() => { setView("workspace"); setSearchQuery(""); }}>
                  <Package size={14} />
                  <span>Sony WH-1000XM5 — Active Warranty (Electronics)</span>
                </div>
                <div className="search-popover-item" onClick={() => { setView("workspace"); setSearchQuery(""); }}>
                  <Package size={14} />
                  <span>LG Refrigerator — AMC Active (Appliances)</span>
                </div>
                <div className="search-popover-item" onClick={() => { setView("workspace"); setSearchQuery(""); }}>
                  <FileText size={14} />
                  <span>Pulse2_warranty_terms.pdf — Document on file</span>
                </div>
              </div>
            )}
          </div>

          {/* Topbar Right Controls */}
          <div className="topbar-right">
            {/* Dark/Light Theme Toggle Pill */}
            <div className="theme-toggle-pill" role="radiogroup" aria-label="Theme selection">
              <button
                type="button"
                className={`theme-btn ${!isDarkTheme ? "active" : ""}`}
                onClick={() => toggleTheme(false)}
                aria-label="Light mode"
                title="Switch to light mode"
              >
                <Sun size={15} />
              </button>
              <button
                type="button"
                className={`theme-btn ${isDarkTheme ? "active" : ""}`}
                onClick={() => toggleTheme(true)}
                aria-label="Dark mode"
                title="Switch to dark mode"
              >
                <Moon size={15} />
              </button>
            </div>

            {/* Notifications Bell */}
            <div className="notification-wrap">
              <button
                type="button"
                className="topbar-icon-btn notification-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="bell-badge">3</span>
              </button>

              {notificationsOpen && (
                <div className="notifications-dropdown" role="menu">
                  <div className="notifications-head">
                    <strong>Notifications</strong>
                    <button className="text-link-xs" onClick={() => setNotificationsOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="notif-item unread">
                    <span className="notif-dot red" />
                    <div>
                      <strong>LG Refrigerator AMC Due</strong>
                      <p>Renewal is due in 14 days. Review your plan.</p>
                    </div>
                  </div>
                  <div className="notif-item unread">
                    <span className="notif-dot green" />
                    <div>
                      <strong>Sony WH-1000XM5 Price Drop</strong>
                      <p>Dropped to ₹24,990 (₹3,000 below purchase price).</p>
                    </div>
                  </div>
                  <div className="notif-item unread">
                    <span className="notif-dot amber" />
                    <div>
                      <strong>Minimalist Sunscreen Restock</strong>
                      <p>Estimated refill needed in 8 days.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Header "+ Add Product" quick action button in dark mode / wide screens */}
            <button
              className="topbar-add-btn"
              onClick={beginClaim}
              aria-label="Add Product"
            >
              <Plus size={15} />
              <span>Add Product</span>
            </button>

            {/* User Profile */}
            <div className="user-profile-btn" role="button" tabIndex={0}>
              <div className="user-avatar-circle">
                <span>R</span>
              </div>
              <span className="user-name">Rohan</span>
            </div>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="content-container" id="home">
          {view === "intake" ? (
            <ClaimIntake onCancel={() => setView("workspace")} onSubmit={submitClaim} />
          ) : view === "review" ? (
            <ClaimReview
              claim={claim}
              approved={approved}
              onApprove={() => setApproved(true)}
              onBack={() => setView("workspace")}
            />
          ) : view === "amazon-import" ? (
            <AmazonImport
              onCancel={() => setView("workspace")}
              onSaved={(_productId, productName) => {
                // Navigate to products view and show success
                setView("products");
                // In a real connected workspace this would refresh the product list
                void productName;
              }}
            />
          ) : view === "claims" ? (
            <ClaimsList
              claims={claims}
              loading={claimsLoading}
              error={claimsError}
              onBack={() => setView("workspace")}
            />
          ) : view === "assistant" ? (
            <AssistantChat />
          ) : view === "products" || view === "prices" || view === "reminders" || view === "timeline" ? (
            <ProductCenter view={view === "timeline" ? "products" : view} />
          ) : view === "settings" || view === "help" ? (
            <PublicDemoNotice onBack={() => setView("workspace")} currentView={view} />
          ) : (
            <DashboardHome
              onStartClaim={beginClaim}
              onOpenReview={() => setView("review")}
              onNavigateTab={(tab) => {
                if (tab === "claims") void loadClaims();
                setView(tab as View);
              }}
              isDarkTheme={isDarkTheme}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function PublicDemoNotice({ onBack, currentView }: { onBack: () => void; currentView?: string }) {
  const titles: Record<string, string> = {
    products: "Private Product Library",
    assistant: "Private Document Q&A",
    prices: "Manual Price Watch",
    reminders: "Usage & Service Reminders",
    claims: "Saved Claims Vault",
    timeline: "Product Ownership Timeline",
    settings: "Workspace Settings",
    help: "Help & Support",
  };

  const currentTitle = currentView && titles[currentView] ? titles[currentView] : "Private Account Feature";

  return (
    <section className="page-content subpage-content" aria-labelledby="public-demo-notice-title">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={16} /> Back to dashboard
      </button>
      <div className="eyebrow">
        <span className="eyebrow-line" /> PUBLIC DEMO · {currentTitle.toUpperCase()}
      </div>
      <h1 id="public-demo-notice-title">Private account features are turned off.</h1>
      <p className="page-lede">
        Products, saved claims, document Q&amp;A, price watches, reminders, and private uploads need an account-owned workspace. This public demo does not connect those features to shared data.
      </p>
      <div className="demo-notice-card">
        <div className="demo-notice-icon">
          <LockKeyhole size={20} />
        </div>
        <div>
          <strong>Explore the public demo safely</strong>
          <p className="local-data-note">
            You can explore the interactive dashboard, view product warranties and price drop alerts, or create a temporary claim preview. Nothing you enter or select is uploaded or saved to any external server.
          </p>
        </div>
      </div>
    </section>
  );
}
