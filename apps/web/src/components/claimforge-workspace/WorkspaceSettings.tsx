"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Bell,
  Camera,
  Check,
  ChevronLeft,
  Cookie,
  Info,
  LoaderCircle,
  Moon,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import type { WorkspaceView } from "./workspace-routes";
import { writeCookiePreferences, readCookiePreferences } from "@/lib/cookie-consent";
import "./WorkspaceSettings.css";

interface WorkspaceSettingsProps {
  userEmail?: string;
  isDarkTheme: boolean;
  onToggleTheme: (isDark: boolean) => void;
  onBack: () => void;
  onNavigate: (view: WorkspaceView) => void;
}

type Profile = { displayName: string | null; hasAvatar: boolean };

export function WorkspaceSettings({
  userEmail,
  isDarkTheme,
  onToggleTheme,
  onBack,
  onNavigate,
}: WorkspaceSettingsProps) {
  // Profile state for authenticated sessions
  const [profile, setProfile] = useState<Profile>({ displayName: null, hasAvatar: false });
  const [displayName, setDisplayName] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [profileLoading, setProfileLoading] = useState(Boolean(userEmail));
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Load profile if signed in
  useEffect(() => {
    if (!userEmail) return;
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Profile could not be loaded.");
        if (active) {
          const nextProfile = result.profile as Profile;
          setProfile(nextProfile);
          setDisplayName(nextProfile.displayName ?? "");
        }
      })
      .catch((reason: unknown) => {
        if (active) setProfileError(reason instanceof Error ? reason.message : "Profile could not be loaded.");
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userEmail]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Profile could not be saved.");
      setProfile((current) => ({ ...current, ...result.profile }));
      setDisplayName(result.profile.displayName ?? "");
      window.dispatchEvent(new Event("product-vault-profile-change"));
      setProfileNotice("Profile saved.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setProfileError("");
    setProfileNotice("");
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileError("Choose a JPEG, PNG, or WebP image smaller than 2 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.set("avatar", file);
      const response = await fetch("/api/account/avatar", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Photo could not be uploaded.");
      setProfile((current) => ({ ...current, hasAvatar: true }));
      setAvatarVersion(Date.now());
      window.dispatchEvent(new Event("product-vault-profile-change"));
      setProfileNotice("Profile photo updated.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Photo could not be uploaded.");
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setPhotoBusy(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Photo could not be removed.");
      setProfile((current) => ({ ...current, hasAvatar: false }));
      setAvatarVersion(Date.now());
      window.dispatchEvent(new Event("product-vault-profile-change"));
      setProfileNotice("Profile photo removed.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Photo could not be removed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const triggerCookieSettings = () => {
    // Open the cookie consent modal by deleting non-essential or dispatching change
    const current = readCookiePreferences();
    writeCookiePreferences(current?.preferences ?? true, current?.analytics ?? false);
  };

  const initials = (displayName || userEmail || "W").trim().slice(0, 1).toUpperCase() || "U";

  return (
    <section className="workspace-settings-container" aria-labelledby="workspace-settings-title">
      {/* Page Header */}
      <div className="settings-header-wrap">
        <button type="button" className="settings-back-btn" onClick={onBack}>
          <ChevronLeft size={16} /> Back to dashboard
        </button>
        <div className="settings-eyebrow">
          <span className="settings-eyebrow-line" /> WORKSPACE
        </div>
        <h1 id="workspace-settings-title" className="settings-title">
          Settings
        </h1>
        <p className="settings-description">
          Manage your workspace preferences, appearance, notifications, and understand how ProductVault works.
        </p>
      </div>

      {/* 1. Appearance Section */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-title-row">
            <Sun size={18} className="settings-section-icon" aria-hidden="true" />
            <h2 className="settings-section-title">Appearance &amp; Theme</h2>
          </div>
          <p className="settings-section-subtitle">
            Choose your preferred display theme. The selected mode is synchronized with your top navigation bar toggle.
          </p>
        </div>

        <div className="theme-selector-grid" role="radiogroup" aria-label="Display theme selection">
          <button
            type="button"
            role="radio"
            aria-checked={!isDarkTheme}
            className={`theme-option-card ${!isDarkTheme ? "is-active" : ""}`}
            onClick={() => onToggleTheme(false)}
          >
            <div className="theme-card-icon-box">
              <Sun size={18} />
            </div>
            <div className="theme-card-text">
              <div className="theme-card-header">
                <span className="theme-card-name">Warm Beige</span>
                <span className="theme-card-badge">Default</span>
              </div>
              <p className="theme-card-desc">
                Original tactile ivory &amp; warm beige palette with high-contrast charcoal typography.
              </p>
            </div>
            <div className="theme-radio-circle" aria-hidden="true">
              {!isDarkTheme && <Check size={12} strokeWidth={3} />}
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={isDarkTheme}
            className={`theme-option-card ${isDarkTheme ? "is-active" : ""}`}
            onClick={() => onToggleTheme(true)}
          >
            <div className="theme-card-icon-box">
              <Moon size={18} />
            </div>
            <div className="theme-card-text">
              <div className="theme-card-header">
                <span className="theme-card-name">Dark Contrast</span>
                <span className="theme-card-badge">Night</span>
              </div>
              <p className="theme-card-desc">
                Deep charcoal canvas with warm muted amber tones for low-light environments.
              </p>
            </div>
            <div className="theme-radio-circle" aria-hidden="true">
              {isDarkTheme && <Check size={12} strokeWidth={3} />}
            </div>
          </button>
        </div>

        <p className="settings-note-text">
          Currently active: <strong>{isDarkTheme ? "Dark Contrast mode" : "Warm Beige mode"}</strong>.
          Theme persistence is maintained across browser sessions when preferences cookies are accepted.
        </p>
      </div>

      {/* 2. Notification Preferences Section */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-title-row">
            <Bell size={18} className="settings-section-icon" aria-hidden="true" />
            <h2 className="settings-section-title">Notification Center &amp; Alerts</h2>
          </div>
          <p className="settings-section-subtitle">
            Understand how in-app alerts, price drop notices, and warranty reminders are dispatched.
          </p>
        </div>

        <div className="settings-feature-list">
          <div className="settings-feature-row">
            <div className="settings-feature-info">
              <span className="settings-feature-label">Warranty Expiration &amp; AMC Nudges</span>
              <p className="settings-feature-desc">
                In-app alerts trigger 14 days before warranty end-dates or maintenance renewal deadlines.
              </p>
            </div>
            <span className="settings-badge active">In-App Active</span>
          </div>

          <div className="settings-feature-row">
            <div className="settings-feature-info">
              <span className="settings-feature-label">Price Watch Target Alerts</span>
              <p className="settings-feature-desc">
                Highlights price drops on tracked Amazon and Flipkart products matching your target price.
              </p>
            </div>
            <span className="settings-badge active">In-App Active</span>
          </div>

          <div className="settings-feature-row">
            <div className="settings-feature-info">
              <span className="settings-feature-label">Usage &amp; Replenishment Countdowns</span>
              <p className="settings-feature-desc">
                Scheduled nudges for consumable items (e.g., sunscreen refills, filter replacements).
              </p>
            </div>
            <span className="settings-badge active">In-App Active</span>
          </div>

          <div className="settings-feature-row">
            <div className="settings-feature-info">
              <span className="settings-feature-label">External Email &amp; Browser Push</span>
              <p className="settings-feature-desc">
                Automated outbound emails and OS push notifications require an external SMTP gateway in connected mode.
              </p>
            </div>
            <span className="settings-badge local">Local Only</span>
          </div>
        </div>

        <p className="settings-note-text">
          Alerts are delivered to the notification bell in the top navigation bar. Click the bell anytime to inspect or dismiss active items.
        </p>
      </div>

      {/* 3. Workspace Overview & Capabilities Section */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-title-row">
            <SlidersHorizontal size={18} className="settings-section-icon" aria-hidden="true" />
            <h2 className="settings-section-title">Workspace Capabilities</h2>
          </div>
          <p className="settings-section-subtitle">
            Factual architecture and runtime data capabilities for this ProductVault environment.
          </p>
        </div>

        <div className="capability-grid">
          <div className="capability-item">
            <span className="capability-key">Environment Mode</span>
            <span className="capability-value">Interactive Workspace (Next.js App Router)</span>
          </div>
          <div className="capability-item">
            <span className="capability-key">Active Catalogue</span>
            <span className="capability-value">12 Products across 4 Categories</span>
          </div>
          <div className="capability-item">
            <span className="capability-key">Document OCR</span>
            <span className="capability-value">In-Browser Tesseract OCR &amp; Canvas</span>
          </div>
          <div className="capability-item">
            <span className="capability-key">Price Tracking</span>
            <span className="capability-value">Cross-Store Comparison (Amazon &amp; Flipkart)</span>
          </div>
          <div className="capability-item">
            <span className="capability-key">Claims Safety Gate</span>
            <span className="capability-value">Mandatory Human-in-the-Loop Review</span>
          </div>
          <div className="capability-item">
            <span className="capability-key">Timeline Engine</span>
            <span className="capability-value">Scroll-Tracked Chronological Event Rail</span>
          </div>
        </div>
      </div>

      {/* 4. Privacy, Account Status & Cookie Controls */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-title-row">
            <ShieldCheck size={18} className="settings-section-icon" aria-hidden="true" />
            <h2 className="settings-section-title">Privacy &amp; Account Status</h2>
          </div>
          <p className="settings-section-subtitle">
            Understand how personal documents are safeguarded and manage local storage preferences.
          </p>
        </div>

        {/* If user is signed in: show profile form with heading "Your account" */}
        {userEmail ? (
          <div>
            <h2 id="account-settings-title" style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 14px 0", color: "var(--text-primary)" }}>
              Your account
            </h2>
            {profileError && <p className="account-settings-message error" role="alert">{profileError}</p>}
            {profileNotice && <p className="account-settings-message success" role="status">{profileNotice}</p>}

            {profileLoading ? (
              <div className="account-settings-loading" role="status">
                <LoaderCircle size={18} className="spin" /> Loading profile…
              </div>
            ) : (
              <form className="account-settings-card" onSubmit={(event) => void saveProfile(event)}>
                <div className="account-photo-row">
                  <div className="account-avatar" aria-label={profile.hasAvatar ? "Profile photo" : "Profile initials"}>
                    {profile.hasAvatar ? (
                      <Image key={avatarVersion} src={`/api/account/avatar?v=${avatarVersion}`} alt="Your profile" width={88} height={88} unoptimized />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="account-photo-copy">
                    <strong>Profile photo</strong>
                    <p>JPEG, PNG, or WebP · up to 2 MB</p>
                    <div className="account-photo-actions">
                      <input
                        ref={fileInput}
                        className="visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Upload profile photo"
                        onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
                      />
                      <button
                        type="button"
                        className="button-secondary account-action-button"
                        disabled={photoBusy}
                        onClick={() => fileInput.current?.click()}
                      >
                        {photoBusy ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
                        Upload photo
                      </button>
                      {profile.hasAvatar && (
                        <button
                          type="button"
                          aria-label="Remove photo"
                          className="button-secondary account-action-button"
                          disabled={photoBusy}
                          onClick={() => void removeAvatar()}
                        >
                          <Trash2 size={15} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <Camera className="account-photo-decoration" size={20} aria-hidden="true" />
                </div>

                <div className="account-form-grid">
                  <label className="account-field" htmlFor="account-display-name">
                    <span>Display name</span>
                    <input
                      id="account-display-name"
                      type="text"
                      value={displayName}
                      maxLength={80}
                      autoComplete="name"
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                    />
                  </label>
                  <label className="account-field" htmlFor="account-email">
                    <span>Email</span>
                    <input id="account-email" type="email" value={userEmail} readOnly disabled />
                    <small>Used to sign in to ProductVault</small>
                  </label>
                </div>

                <div className="account-auth-note">
                  <div>
                    <strong>Sign-in method</strong>
                    <p>You sign in with Google or email sign-in link.</p>
                  </div>
                  <span>Passwordless</span>
                </div>

                <div className="account-form-footer">
                  <button type="button" className="button-secondary" onClick={onBack}>Cancel</button>
                  <button type="submit" className="button-primary" disabled={profileSaving || profileLoading}>
                    {profileSaving && <LoaderCircle size={15} className="spin" />} Save changes
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* If in demo mode: show honest, compact workspace status card */
          <div className="demo-status-box">
            <div className="demo-status-top">
              <div className="demo-status-title-group">
                <Shield size={18} className="settings-section-icon" aria-hidden="true" />
                <h3>Local Interactive Workspace</h3>
              </div>
              <span className="demo-status-badge">Prototype</span>
            </div>
            <p className="demo-status-desc">
              You are exploring ProductVault in a local interactive session. In this mode, pre-loaded sample products, invoices, price watches, and claims operate safely in browser memory without sending private records to an external cloud database.
            </p>
            <ul className="demo-status-bullets">
              <li>
                <Check size={14} className="demo-bullet-icon-check" aria-hidden="true" />
                <span>Full access to dashboard metrics, warranty dates, and timeline scroll rails.</span>
              </li>
              <li>
                <Check size={14} className="demo-bullet-icon-check" aria-hidden="true" />
                <span>Local invoice OCR extraction, passport view, and draft evidence editing.</span>
              </li>
              <li>
                <Check size={14} className="demo-bullet-icon-check" aria-hidden="true" />
                <span>Manual price watch checks across Amazon and Flipkart.</span>
              </li>
              <li>
                <Info size={14} className="demo-bullet-icon-info" aria-hidden="true" />
                <span>Cross-device synchronization and outbound emails require a connected Supabase backend.</span>
              </li>
            </ul>
          </div>
        )}

        <div className="settings-cookie-row">
          <div>
            <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>Cookie Preferences &amp; Local Storage</strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Manage essential security cookies and optional theme preference storage.
            </p>
          </div>
          <button
            type="button"
            className="settings-cookie-btn"
            onClick={triggerCookieSettings}
            title="Update cookie settings"
          >
            <Cookie size={14} /> Update cookie choices
          </button>
        </div>
      </div>
    </section>
  );
}
