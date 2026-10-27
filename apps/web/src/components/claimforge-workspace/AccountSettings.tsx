"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, LoaderCircle, Trash2, Upload } from "lucide-react";

type Profile = { displayName: string | null; hasAvatar: boolean };

export function AccountSettings({ email, onBack }: { email: string; onBack: () => void }) {
  const [profile, setProfile] = useState<Profile>({ displayName: null, hasAvatar: false });
  const [displayName, setDisplayName] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
        if (active) setError(reason instanceof Error ? reason.message : "Profile could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
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
      setNotice("Profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image smaller than 2 MB.");
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
      setNotice("Profile photo updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Photo could not be uploaded.");
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setPhotoBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Photo could not be removed.");
      setProfile((current) => ({ ...current, hasAvatar: false }));
      setAvatarVersion(Date.now());
      window.dispatchEvent(new Event("product-vault-profile-change"));
      setNotice("Profile photo removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Photo could not be removed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const initials = (displayName || email).trim().slice(0, 1).toUpperCase() || "U";

  return (
    <section className="page-content account-settings-page" aria-labelledby="account-settings-title">
      <button type="button" className="back-link" onClick={onBack}>
        <ChevronLeft size={16} /> Back to dashboard
      </button>
      <div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div>
      <div className="account-settings-heading">
        <div>
          <h1 id="account-settings-title">Your account</h1>
          <p className="page-lede">Keep your ProductVault profile up to date.</p>
        </div>
      </div>

      {error && <p className="account-settings-message error" role="alert">{error}</p>}
      {notice && <p className="account-settings-message success" role="status">{notice}</p>}
      {loading ? (
        <div className="account-settings-loading" role="status"><LoaderCircle size={18} className="spin" /> Loading your profile…</div>
      ) : (
        <form className="account-settings-card" onSubmit={(event) => void saveProfile(event)}>
          <div className="account-photo-row">
            <div className="account-avatar" aria-label={profile.hasAvatar ? "Profile photo" : "Profile initials"}>
              {profile.hasAvatar ? (
                <Image key={avatarVersion} src={`/api/account/avatar?v=${avatarVersion}`} alt="Your profile" width={88} height={88} unoptimized />
              ) : <span>{initials}</span>}
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
                <button type="button" className="button-secondary account-action-button" disabled={photoBusy} onClick={() => fileInput.current?.click()}>
                  {photoBusy ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
                  Upload photo
                </button>
                {profile.hasAvatar && <button type="button" aria-label="Remove photo" className="button-secondary account-action-button" disabled={photoBusy} onClick={() => void removeAvatar()}><Trash2 size={15} /> Remove</button>}
              </div>
            </div>
            <Camera className="account-photo-decoration" size={20} aria-hidden="true" />
          </div>

          <div className="account-form-grid">
            <label className="account-field" htmlFor="account-display-name">
              <span>Display name</span>
              <input id="account-display-name" type="text" value={displayName} maxLength={80} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} required />
            </label>
            <label className="account-field" htmlFor="account-email">
              <span>Email</span>
              <input id="account-email" type="email" value={email} readOnly disabled />
              <small>Used to sign in to ProductVault</small>
            </label>
          </div>

          <div className="account-auth-note">
            <div><strong>Sign-in method</strong><p>You sign in with Google or email sign-in link.</p></div>
            <span>Passwordless</span>
          </div>

          <div className="account-form-footer">
            <button type="button" className="button-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="button-primary" disabled={saving || loading}>
              {saving && <LoaderCircle size={15} className="spin" />} Save changes
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
