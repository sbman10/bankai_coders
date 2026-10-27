"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  FileText,
  GitCommit,
  HelpCircle,
  Home,
  LockKeyhole,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  TrendingDown,
  X,
} from "lucide-react";
import { ClaimIntake } from "./ClaimIntake";
import { ClaimReview } from "./ClaimReview";
import { DashboardHome } from "./DashboardHome";
import { AmazonImport } from "./AmazonImport";
import { ProductCenter } from "./ProductCenter";
import { ClaimsList, type SavedClaim } from "./ClaimsList";
import { AssistantChat } from "./AssistantChat";
import { AccountMenu } from "./AccountMenu";
import { AccountSettings } from "./AccountSettings";
import { ClaimForgeLogoMark } from "./ProductVisuals";
import { sampleClaim, type ClaimIntakePayload, type ClaimSubmission } from "./types";
import { readCookiePreferences, THEME_PREFERENCE_KEY } from "@/lib/cookie-consent";

let temporaryTheme: "light" | "dark" | null = null;

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

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("product-vault-theme-change", callback);
  window.addEventListener("product-vault-cookie-consent-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("product-vault-theme-change", callback);
    window.removeEventListener("product-vault-cookie-consent-change", callback);
  };
}

function getClientThemeSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (readCookiePreferences()?.preferences) return localStorage.getItem(THEME_PREFERENCE_KEY) === "dark";
  return temporaryTheme === "dark";
}

function getServerThemeSnapshot(): boolean {
  return false;
}

export function ClaimForgeWorkspace({ userEmail, onSignOut }: { userEmail?: string; onSignOut?: () => void | Promise<void> } = {}) {
  const [view, setView] = useState<View>("workspace");
  const [claim, setClaim] = useState<ClaimSubmission>(sampleClaim);
  const [approved, setApproved] = useState(false);
  const isDarkTheme = useSyncExternalStore(
    subscribeTheme,
    getClientThemeSnapshot,
    getServerThemeSnapshot
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Synchronize DOM data-theme and body attributes on mount
  useEffect(() => {
    const isDark = getClientThemeSnapshot();
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }

    // Keyboard shortcut for Cmd/Ctrl + K and Escape for drawer
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("header-search-input");
        searchInput?.focus();
      }
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [claims, setClaims] = useState<SavedClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState("");

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    setClaimsError("");
    try {
      const response = await fetch("/api/claims", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't load claims.");
      setClaims(result.claims ?? []);
    } catch (err) {
      setClaimsError(err instanceof Error ? err.message : "Couldn't load claims.");
    } finally {
      setClaimsLoading(false);
    }
  }, []);

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

  const toggleTheme = useCallback((newDarkState: boolean) => {
    const themeStr = newDarkState ? "dark" : "light";
    temporaryTheme = themeStr;
    if (readCookiePreferences()?.preferences) localStorage.setItem(THEME_PREFERENCE_KEY, themeStr);
    else localStorage.removeItem(THEME_PREFERENCE_KEY);
    if (newDarkState) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark");
    }
    window.dispatchEvent(new Event("product-vault-theme-change"));
  }, []);

  function beginClaim() {
    setApproved(false);
    setView("intake");
  }

  async function submitClaim(nextClaim: ClaimIntakePayload, _idempotencyKey?: string): Promise<void> {
    void _idempotencyKey;
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

  function handleNavigate(targetView: View) {
    if (targetView === "claims") void loadClaims();
    setView(targetView);
    setDrawerOpen(false);
  }

  return (
    <div
      className={`app-shell ${isDarkTheme ? "dark-theme" : "light-theme"}`}
      suppressHydrationWarning
    >
      {/* Top Horizontal Navigation Bar (Image A) */}
      <header className="workspace-top-navbar" role="banner">
        <div className="navbar-left-group">
          <button
            type="button"
            className="navbar-hamburger-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            title="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="navbar-vdivider" aria-hidden="true" />

          <a
            className="navbar-brand-link"
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setView("workspace");
            }}
          >
            <ClaimForgeLogoMark className="navbar-logo-cube" />
            <span className="navbar-brand-text">
              Product<span className="brand-orange">Vault</span>
            </span>
          </a>
        </div>

        {/* Center Pill-Shaped Search Bar */}
        <div className={`navbar-search-pill ${searchFocused ? "is-focused" : ""}`}>
          <Search size={16} className="search-pill-icon" />
          <input
            id="header-search-input"
            type="search"
            className="search-pill-input"
            placeholder="Search your products, documents, or ask anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            aria-label="Search products, documents, or ask anything"
          />
          <div className="search-shortcut-pill" title="Press Ctrl+K or ⌘K">
            <span className="kbd-symbol">⌘</span>
            <span>K</span>
          </div>

          {/* Quick search popover preview */}
          {searchFocused && searchQuery && (
            <div className="search-popover-dropdown">
              <div
                className="search-dropdown-item"
                onClick={() => {
                  setView("products");
                  setSearchQuery("");
                }}
              >
                <Package size={14} />
                <span>Search for &quot;{searchQuery}&quot; in Products Library</span>
              </div>
              <div
                className="search-dropdown-item"
                onClick={() => {
                  setView("assistant");
                  setSearchQuery("");
                }}
              >
                <FileText size={14} />
                <span>Ask Document Assistant about &quot;{searchQuery}&quot;</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Controls: Theme, Notifications, Profile */}
        <div className="navbar-right-group">
          {/* Circular Theme Toggle */}
          <button
            type="button"
            className="navbar-circle-btn theme-toggle-btn"
            onClick={() => toggleTheme(!isDarkTheme)}
            aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
            suppressHydrationWarning
          >
            {isDarkTheme ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Notifications Bell */}
          <div className="notification-bell-wrap">
            <button
              type="button"
              className="navbar-circle-btn notification-bell-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} />
              <span className="bell-count-dot">3</span>
            </button>

            {notificationsOpen && (
              <div className="notifications-dropdown-menu" role="menu">
                <div className="notifications-head">
                  <strong>Notifications</strong>
                  <button
                    type="button"
                    className="notif-close-link"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="notif-row unread">
                  <span className="notif-status-dot red" />
                  <div>
                    <strong>LG Refrigerator AMC Due</strong>
                    <p>Renewal is due in 14 days. Review your plan.</p>
                  </div>
                </div>
                <div className="notif-row unread">
                  <span className="notif-status-dot green" />
                  <div>
                    <strong>Sony WH-1000XM5 Price Drop</strong>
                    <p>Dropped to ₹24,990 (₹3,000 below purchase price).</p>
                  </div>
                </div>
                <div className="notif-row unread">
                  <span className="notif-status-dot amber" />
                  <div>
                    <strong>Minimalist Sunscreen Restock</strong>
                    <p>Estimated refill needed in 8 days.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {userEmail ? (
            <AccountMenu
              email={userEmail}
              onOpenSettings={() => setView("settings")}
              onSignOut={onSignOut}
            />
          ) : (
            <div className="navbar-user-profile-pill" aria-label="Workspace preview">
              <span className="user-initial-avatar"><span>W</span></span>
              <span className="user-display-name">Workspace</span>
              <ChevronDown size={14} className="profile-chevron-icon" />
            </div>
          )}
        </div>
      </header>

      {/* Slide-out Navigation Drawer (Hamburger Menu) */}
      <div
        className={`navigation-drawer-overlay ${drawerOpen ? "is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      >
        <aside
          className="navigation-drawer-panel"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          <div className="drawer-header">
            <div className="drawer-brand-lockup">
              <ClaimForgeLogoMark className="drawer-logo-cube" />
              <span className="drawer-brand-name">
                Product<span className="brand-orange">Vault</span>
              </span>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Drawer Navigation Links */}
          <nav className="drawer-nav-list" aria-label="Workspace">
            <button
              type="button"
              className={`drawer-nav-link ${view === "workspace" ? "active" : ""}`}
              onClick={() => handleNavigate("workspace")}
            >
              <Home size={17} />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "products" ? "active" : ""}`}
              onClick={() => handleNavigate("products")}
              aria-label="Products"
            >
              <Package size={17} />
              <span>My Products</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "timeline" ? "active" : ""}`}
              onClick={() => handleNavigate("timeline")}
              aria-label="Timeline"
            >
              <GitCommit size={17} />
              <span>Timeline</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "prices" ? "active" : ""}`}
              onClick={() => handleNavigate("prices")}
              aria-label="Price Watch"
            >
              <TrendingDown size={17} />
              <span>Price Watch</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "reminders" ? "active" : ""}`}
              onClick={() => handleNavigate("reminders")}
              aria-label="Reminders"
            >
              <Bell size={17} />
              <span>Reminders</span>
              <span className="drawer-badge-count">3</span>
            </button>

            <div className="drawer-section-heading">Tools &amp; Assistant</div>

            <button
              type="button"
              className={`drawer-nav-link ${view === "assistant" ? "active" : ""}`}
              onClick={() => handleNavigate("assistant")}
              aria-label="Ask documents"
            >
              <FileText size={17} />
              <span>Documents Q&amp;A</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "amazon-import" ? "active" : ""}`}
              onClick={() => handleNavigate("amazon-import")}
              aria-label="Import from Amazon"
            >
              <ShoppingBag size={17} />
              <span>Import from Amazon</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "claims" ? "active" : ""}`}
              onClick={() => handleNavigate("claims")}
              aria-label="My Claims"
            >
              <ShieldCheck size={17} />
              <span>Warranty Claims</span>
              {claims.length > 0 && <span className="drawer-badge-count">{claims.length}</span>}
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "intake" ? "active" : ""}`}
              onClick={() => {
                setDrawerOpen(false);
                beginClaim();
              }}
              aria-label="Start a claim"
            >
              <ShieldCheck size={17} />
              <span>Start a claim</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "review" ? "active" : ""}`}
              onClick={() => {
                setDrawerOpen(false);
                setView("review");
              }}
              aria-label="Review claim"
            >
              <FileText size={17} />
              <span>Review claim</span>
            </button>

            <div className="drawer-section-heading">Account &amp; Settings</div>

            <button
              type="button"
              className={`drawer-nav-link ${view === "settings" ? "active" : ""}`}
              onClick={() => handleNavigate("settings")}
              aria-label="Settings"
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              className={`drawer-nav-link ${view === "help" ? "active" : ""}`}
              onClick={() => handleNavigate("help")}
              aria-label="Help & Support"
            >
              <HelpCircle size={17} />
              <span>Help &amp; Support</span>
            </button>
          </nav>
        </aside>
      </div>

      {/* Main Page Viewport Container */}
      <main className="workspace-main-viewport" id="home">
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
              setView("products");
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
          <ProductCenter view={view} />
        ) : view === "settings" && userEmail ? (
          <AccountSettings email={userEmail} onBack={() => setView("workspace")} />
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
        <span className="eyebrow-line" /> {currentTitle.toUpperCase()}
      </div>
      <h1 id="public-demo-notice-title">Private account features are turned off.</h1>
      <p className="page-lede">
        Products, saved claims, document Q&amp;A, price watches, reminders, and private uploads need an account-owned workspace.
      </p>
      <div className="demo-notice-card">
        <div className="demo-notice-icon">
          <LockKeyhole size={20} />
        </div>
        <div>
          <strong>Explore the interactive workspace</strong>
          <p className="local-data-note">
            You can explore the interactive dashboard, view product passports, warranties, price watches, and product timelines.
          </p>
        </div>
      </div>
    </section>
  );
}
