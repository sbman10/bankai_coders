"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

export function AccountMenu({
  email,
  onOpenSettings,
  onSignOut,
}: {
  email: string;
  onOpenSettings: () => void;
  onSignOut?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [hasAvatar, setHasAvatar] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const refreshProfile = () => {
      void fetch("/api/account/profile", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const result = await response.json();
          if (active) {
            setDisplayName(result.profile?.displayName ?? "");
            setHasAvatar(Boolean(result.profile?.hasAvatar));
            setAvatarVersion(Date.now());
          }
        })
        .catch(() => { /* Keep the email-based fallback identity. */ });
    };
    refreshProfile();
    window.addEventListener("product-vault-profile-change", refreshProfile);
    return () => {
      active = false;
      window.removeEventListener("product-vault-profile-change", refreshProfile);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const label = displayName || email;
  const initials = label.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="account-menu-wrap" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="navbar-user-profile-pill"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-initial-avatar">
          {hasAvatar ? <Image key={avatarVersion} src={`/api/account/avatar?v=${avatarVersion}`} alt="" width={34} height={34} unoptimized /> : <span>{initials}</span>}
        </span>
        <span className="user-display-name">{label}</span>
        <ChevronDown size={14} className="profile-chevron-icon" />
      </button>
      {open && (
        <div className="account-dropdown-menu" role="menu" aria-label="Account" onKeyDown={(event) => {
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']")];
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowUp" ? (current - 1 + items.length) % items.length : -1;
          if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
          if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
          if (event.key === "End") { event.preventDefault(); items.at(-1)?.focus(); }
        }}>
          <div className="account-dropdown-identity">
            <strong>{displayName || "Your account"}</strong>
            <span>{email}</span>
          </div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }}>
            <UserRound size={16} /> Account settings
          </button>
          {onSignOut && <button type="button" role="menuitem" onClick={() => { setOpen(false); void onSignOut(); }}>
            <LogOut size={16} /> Sign out
          </button>}
        </div>
      )}
    </div>
  );
}
