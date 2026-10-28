"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Info, X } from "lucide-react";
import type { WorkspaceView } from "./workspace-routes";
import "./NotificationCenter.css";

export type NotificationItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  relativeTime: string;
  statusKind: "urgent" | "price-drop" | "restock" | "info";
  unread: boolean;
  targetView: WorkspaceView;
};

const initialNotifications: NotificationItem[] = [
  {
    id: "notif-lg-amc",
    category: "Appliance AMC",
    title: "LG Refrigerator AMC Due",
    description: "Annual maintenance contract renewal is due in 14 days. Review your plan and warranty coverage.",
    relativeTime: "In 14 days",
    statusKind: "urgent",
    unread: true,
    targetView: "reminders",
  },
  {
    id: "notif-sony-price",
    category: "Price Watch Alert",
    title: "Sony WH-1000XM5 Price Drop",
    description: "Dropped to ₹24,990 on Amazon (₹3,000 below your purchase price of ₹26,990).",
    relativeTime: "Observed today",
    statusKind: "price-drop",
    unread: true,
    targetView: "prices",
  },
  {
    id: "notif-sunscreen-refill",
    category: "Replenishment Nudge",
    title: "Minimalist Sunscreen Restock",
    description: "Estimated refill needed in 8 days based on your recorded 45-day personal care usage cycle.",
    relativeTime: "In 8 days",
    statusKind: "restock",
    unread: true,
    targetView: "reminders",
  },
];

interface NotificationCenterProps {
  onClose: () => void;
  onNavigate: (view: WorkspaceView) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationCenter({
  onClose,
  onNavigate,
  triggerRef,
  unreadCount,
  onUnreadCountChange,
}: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside click & Escape key detection
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, triggerRef]);

  // Keep unread count synchronized with current list
  const currentUnreadCount = items.filter((item) => item.unread).length;
  useEffect(() => {
    if (currentUnreadCount !== unreadCount) {
      onUnreadCountChange(currentUnreadCount);
    }
  }, [currentUnreadCount, unreadCount, onUnreadCountChange]);

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    onUnreadCountChange(0);
  };

  const handleItemClick = (item: NotificationItem) => {
    // Mark clicked item as read
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    onNavigate(item.targetView);
    onClose();
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div
      ref={popoverRef}
      className="notification-center-popover"
      role="dialog"
      aria-label="Notification center"
      aria-modal="false"
    >
      <div className="notif-header">
        <div className="notif-header-title-group">
          <h2 className="notif-title">Notifications</h2>
          {currentUnreadCount > 0 ? (
            <span className="notif-badge-pill">{currentUnreadCount} new</span>
          ) : (
            <span className="notif-badge-pill" style={{ opacity: 0.7 }}>0 unread</span>
          )}
        </div>

        <div className="notif-header-actions">
          {currentUnreadCount > 0 && (
            <button
              type="button"
              className="notif-mark-read-btn"
              onClick={handleMarkAllRead}
              title="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            className="notif-close-btn"
            onClick={onClose}
            aria-label="Close notifications"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="notif-list" role="list">
        {items.length === 0 ? (
          <div className="notif-empty-state">
            <div className="notif-empty-icon">
              <CheckCircle2 size={22} />
            </div>
            <strong className="notif-empty-title">All caught up</strong>
            <p className="notif-empty-desc">
              No active alerts. You will be notified here when product warranties approach or price drops occur.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`notif-item ${item.unread ? "is-unread" : "is-read"}`}
              role="listitem"
            >
              <button
                type="button"
                className="notif-item-body"
                onClick={() => handleItemClick(item)}
                aria-label={`${item.title}. ${item.description}`}
              >
                <div className="notif-dot-wrapper">
                  <span
                    className={`notif-dot ${item.statusKind}`}
                    aria-hidden="true"
                  />
                </div>

                <div className="notif-content">
                  <div className="notif-meta-row">
                    <span className="notif-category">{item.category}</span>
                    <span className="notif-time">{item.relativeTime}</span>
                  </div>
                  <div className="notif-item-title">{item.title}</div>
                  <p className="notif-item-desc">{item.description}</p>
                </div>
              </button>

              <div className="notif-item-actions">
                <button
                  type="button"
                  className="notif-dismiss-btn"
                  onClick={(e) => handleDismiss(e, item.id)}
                  aria-label={`Dismiss notification: ${item.title}`}
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="notif-footer">
        <Info size={13} className="notif-footer-icon" aria-hidden="true" />
        <span>In-app alerts from active product warranties, price checks, and usage reminders.</span>
      </div>
    </div>
  );
}
