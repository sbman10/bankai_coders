"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGreeting } from "@/lib/time/useGreeting";
import {
  addDays,
  calculateRelativeCountdown,
  formatCalendarDateWithWeekday,
  parseDateOnly,
} from "@/lib/time/dates";
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
  Package,
  Plus,
  X,
} from "lucide-react";

export type ProductCardItem = {
  id: string;
  name: string;
  brand: string;
  category: "Electronics" | "Appliances" | "Personal Care" | "Accessories";
  categoryLabel?: string;
  statusText: string;
  statusKind: "warranty-active" | "renew-soon" | "restock-soon" | "amc-active" | "added-manually";
  addedDate: string;
  documentCount?: number;
  imageSrc?: string;
  serialNumber: string;
  price: string;
  warrantyEnd: string;
  invoiceName?: string;
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
    id: "soundcore-q30",
    name: "Soundcore Life Q30",
    brand: "Anker",
    category: "Electronics",
    statusText: "Warranty Active",
    statusKind: "warranty-active",
    addedDate: "Added 14 Oct 2026",
    documentCount: 2,
    imageSrc: "/products/soundcore_q30.png",
    serialNumber: "SN-ANK-Q30-9921",
    price: "₹6,999",
    warrantyEnd: "14 Oct 2027",
    invoiceName: "Anker_Soundcore_Invoice.pdf",
    supportLink: "https://support.soundcore.com",
  },
  {
    id: "ipad-air-m2",
    name: "iPad Air M2",
    brand: "Apple",
    category: "Electronics",
    statusText: "Warranty Active",
    statusKind: "warranty-active",
    addedDate: "Added 15 May 2026",
    documentCount: 3,
    imageSrc: "/products/macbook_air_m3.png",
    serialNumber: "SN-DMPXYZ8819",
    price: "₹59,900",
    warrantyEnd: "15 May 2027",
    invoiceName: "Imagine_Store_Invoice.pdf",
    supportLink: "https://support.apple.com/ipad",
  },
  {
    id: "philips-air-fryer",
    name: "Philips HD9252 Air Fryer",
    brand: "Philips",
    category: "Appliances",
    statusText: "Added Manually",
    statusKind: "added-manually",
    addedDate: "Added 10 Sep 2026",
    documentCount: 1,
    imageSrc: "/products/lg_refrigerator.png",
    serialNumber: "SN-PH-AF-4421",
    price: "₹8,995",
    warrantyEnd: "10 Sep 2028",
    invoiceName: "Philips_Appliance_Bill.pdf",
    supportLink: "https://www.philips.co.in/c-m-ho/cooking/airfryer",
  },
  {
    id: "philips-trimmer",
    name: "Philips OneBlade Pro",
    brand: "Philips",
    category: "Personal Care",
    statusText: "Warranty Active",
    statusKind: "warranty-active",
    addedDate: "Added 05 Jul 2026",
    documentCount: 2,
    imageSrc: "/products/minimalist_sunscreen.png",
    serialNumber: "SN-PH-OB-8192",
    price: "₹2,499",
    warrantyEnd: "05 Jul 2028",
    invoiceName: "Philips_PersonalCare_Invoice.pdf",
    supportLink: "https://www.philips.co.in/c-m-pe/oneblade-face-style-and-shave",
  },
  {
    id: "oral-b-smart",
    name: "Oral-B Smart Series",
    brand: "Oral-B",
    category: "Personal Care",
    statusText: "Restock Soon",
    statusKind: "restock-soon",
    addedDate: "Added 12 Aug 2026",
    documentCount: 1,
    imageSrc: "/products/minimalist_sunscreen.png",
    serialNumber: "LOT-OB-2026-AUG",
    price: "₹3,499",
    warrantyEnd: "12 Aug 2027",
    invoiceName: "Amazon_OralB_Invoice.pdf",
    supportLink: "https://www.oralb.com/contact-us",
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
];

export type TodayTaskItem = {
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

export function createTodayTasks(baseDate: Date = new Date()): TodayTaskItem[] {
  const cd1 = calculateRelativeCountdown(addDays(baseDate, 14), baseDate);
  const cd2 = calculateRelativeCountdown(addDays(baseDate, 8), baseDate);
  const cd3 = calculateRelativeCountdown(addDays(baseDate, 31), baseDate);

  return [
    {
      id: "today-1",
      productName: "LG Refrigerator",
      actionTitle: "AMC renewal due",
      actionColor: "red",
      dueText: cd1.dueText,
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
      dueText: cd2.dueText,
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
      dueText: cd3.dueText,
      dueKind: "gray",
      btnText: "View Details",
      btnAction: "products",
      imageSrc: "/products/titan_watch.png",
      done: false,
    },
  ];
}

export const initialTodayTasks: TodayTaskItem[] = createTodayTasks();

export type MasterTimelineEntry = {
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

const emptyDashboardProducts: ProductCardItem[] = [];
const emptyDashboardTimeline: MasterTimelineEntry[] = [];

export function createMasterTimelineData(baseDate: Date = new Date()): MasterTimelineEntry[] {
  const target1 = addDays(baseDate, 14);
  const target2 = addDays(baseDate, 8);
  const target3 = addDays(baseDate, 31);
  const target5 = parseDateOnly("2027-01-12");
  const target6 = parseDateOnly("2027-02-28");
  const target7 = parseDateOnly("2027-03-15");

  const cd1 = calculateRelativeCountdown(target1, baseDate);
  const cd2 = calculateRelativeCountdown(target2, baseDate);
  const cd3 = calculateRelativeCountdown(target3, baseDate);
  const cd5 = calculateRelativeCountdown(target5, baseDate);
  const cd6 = calculateRelativeCountdown(target6, baseDate);
  const cd7 = calculateRelativeCountdown(target7, baseDate);

  const formatDay = (d: Date) => String(d.getDate()).padStart(2, "0");
  const formatMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });

  return [
    {
      id: "tl-1",
      section: "Upcoming",
      day: formatDay(target1),
      month: formatMonth(target1),
      dotColor: "#EF4444",
      title: "LG Refrigerator",
      subtitle: "AMC renewal due",
      badgeText: cd1.badgeText,
      badgeKind: "red",
      imageSrc: "/products/lg_refrigerator.png",
    },
    {
      id: "tl-2",
      day: formatDay(target2),
      month: formatMonth(target2),
      dotColor: "#F59E0B",
      title: "Minimalist Sunscreen",
      subtitle: "Time to restock",
      badgeText: cd2.badgeText,
      badgeKind: "amber",
      imageSrc: "/products/minimalist_sunscreen.png",
    },
    {
      id: "tl-3",
      day: formatDay(target3),
      month: formatMonth(target3),
      dotColor: "#94A3B8",
      title: "Titan Watch",
      subtitle: "Warranty check reminder",
      badgeText: cd3.badgeText,
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
      badgeText: cd5.badgeText,
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
      badgeText: cd6.badgeText,
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
      badgeText: cd7.badgeText,
      badgeKind: "gray",
      imageSrc: "/products/sony_wh1000xm5.png",
    },
  ];
}

export const masterTimelineData: MasterTimelineEntry[] = createMasterTimelineData();

type DashboardCollections = {
  products: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  watches: Record<string, unknown>[];
  claims: Record<string, unknown>[];
};

type OwnerDashboardSnapshot = {
  ownerKey: string;
  products: ProductCardItem[];
  timeline: MasterTimelineEntry[];
};

const dashboardCollectionEndpoints = [
  ["products", "/api/products"],
  ["reminders", "/api/reminders"],
  ["watches", "/api/price-watches"],
  ["claims", "/api/claims"],
] as const;

function dashboardText(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === "string" ? String(row[key]).trim() : "";
}

function dashboardCategory(category: string): ProductCardItem["category"] {
  const value = category.toLowerCase();
  if (/personal|care|beauty|skin|cosmetic/.test(value)) return "Personal Care";
  if (/appliance|home|refrigerator|fridge|washing|microwave|air conditioner/.test(value)) return "Appliances";
  if (/electronic|audio|phone|mobile|computer|laptop|tablet|headphone|camera|television|\btv\b/.test(value)) return "Electronics";
  return "Accessories";
}

function dashboardImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const imageUrl = value.trim();
  if (imageUrl.startsWith("/")) return imageUrl;
  try {
    return new URL(imageUrl).protocol === "https:" ? imageUrl : undefined;
  } catch {
    return undefined;
  }
}

function dashboardDisplayDate(value: string): string {
  return value ? formatCalendarDateWithWeekday(value) : "Not recorded";
}

function dashboardCurrency(amount: number, currency: string): string {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "INR";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: safeCurrency }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toLocaleString("en-IN")}`;
  }
}

function dashboardProductFromRow(row: Record<string, unknown>, baseDate: Date): ProductCardItem | null {
  const id = dashboardText(row, "id");
  const name = dashboardText(row, "name");
  if (!id || !name) return null;

  const categoryLabel = dashboardText(row, "category") || "Other";
  const warrantyEnd = dashboardText(row, "warranty_end");
  const warrantyCountdown = warrantyEnd ? calculateRelativeCountdown(warrantyEnd, baseDate) : null;
  const price = Number(row.price_paid);
  const currency = dashboardText(row, "currency") || "INR";
  let formattedPrice = "Not recorded";
  if (Number.isFinite(price) && price > 0) {
    formattedPrice = dashboardCurrency(price, currency);
  }

  const createdAt = dashboardText(row, "created_at") || dashboardText(row, "purchase_date");
  const imageSrc = dashboardImageUrl(row.image_url) ?? dashboardImageUrl(row.image_urls instanceof Array ? row.image_urls[0] : undefined);
  const isPersonalCare = dashboardCategory(categoryLabel) === "Personal Care";
  const warrantyExpired = warrantyCountdown?.daysRemaining !== undefined && warrantyCountdown.daysRemaining < 0;
  const warrantySoon = warrantyCountdown?.daysRemaining !== undefined && warrantyCountdown.daysRemaining >= 0 && warrantyCountdown.daysRemaining <= 30;

  return {
    id,
    name,
    brand: dashboardText(row, "brand"),
    category: dashboardCategory(categoryLabel),
    categoryLabel,
    statusText: warrantyEnd
      ? warrantyExpired ? "Warranty expired" : warrantySoon ? `Renew in ${warrantyCountdown?.daysRemaining} days` : "Warranty active"
      : isPersonalCare ? "Restock reminder available" : "Details incomplete",
    statusKind: warrantyEnd && !warrantyExpired ? warrantySoon ? "renew-soon" : "warranty-active" : isPersonalCare ? "restock-soon" : "added-manually",
    addedDate: createdAt ? `Added ${dashboardDisplayDate(createdAt)}` : "Purchase date not recorded",
    imageSrc,
    serialNumber: dashboardText(row, "serial_number") || "Not recorded",
    price: formattedPrice,
    warrantyEnd: dashboardDisplayDate(warrantyEnd),
  };
}

function dashboardProductImage(product: ProductCardItem, className: string, decorative = false) {
  return product.imageSrc ? (
    <img src={product.imageSrc} alt={decorative ? "" : product.name} className={className} loading="lazy" />
  ) : (
    <Package size={decorative ? 20 : 42} strokeWidth={1.5} className={`${className}-fallback`} aria-hidden="true" />
  );
}

function dashboardTimelineFromRows(collections: DashboardCollections, baseDate: Date): MasterTimelineEntry[] {
  const productById = new Map(collections.products.map((product) => [dashboardText(product, "id"), product]));
  const events: Array<MasterTimelineEntry & { sortDate: string }> = [];
  const addEvent = (input: {
    id: string;
    productId: string;
    date: string;
    subtitle: string;
    badgeText?: string;
    badgeKind?: MasterTimelineEntry["badgeKind"];
  }) => {
    if (!input.date) return;
    const date = input.date.slice(0, 10);
    const parsedDate = parseDateOnly(date);
    if (Number.isNaN(parsedDate.getTime())) return;
    const product = productById.get(input.productId);
    const title = product ? dashboardText(product, "name") : "Product activity";
    const countdown = calculateRelativeCountdown(parsedDate, baseDate);
    events.push({
      id: input.id,
      day: String(parsedDate.getDate()).padStart(2, "0"),
      month: parsedDate.toLocaleDateString("en-GB", { month: "short" }),
      dotColor: input.badgeKind === "red" ? "#EF4444" : input.badgeKind === "amber" ? "#F59E0B" : input.badgeKind === "blue" ? "#3B82F6" : "#94A3B8",
      title,
      subtitle: input.subtitle,
      badgeText: input.badgeText ?? countdown.badgeText,
      badgeKind: input.badgeKind ?? (countdown.urgency === "red" ? "red" : countdown.urgency === "amber" ? "amber" : "gray"),
      imageSrc: dashboardImageUrl(product?.image_url) ?? "",
      sortDate: date,
    });
  };

  for (const product of collections.products) {
    const id = dashboardText(product, "id");
    if (dashboardText(product, "purchase_date")) addEvent({ id: `purchase-${id}`, productId: id, date: dashboardText(product, "purchase_date"), subtitle: "Product purchased", badgeText: "Purchased", badgeKind: "gray" });
    if (dashboardText(product, "warranty_end")) addEvent({ id: `warranty-${id}`, productId: id, date: dashboardText(product, "warranty_end"), subtitle: "Warranty expires", badgeKind: "amber" });
  }

  const reminderLabels: Record<string, string> = {
    warranty_expiry: "Warranty or policy expiry",
    service: "Service and maintenance",
    replenishment: "Replenishment reminder",
    claim_follow_up: "Claim follow-up",
    price_target: "Price target alert",
  };
  for (const reminder of collections.reminders) {
    const status = dashboardText(reminder, "status");
    if (status && !["scheduled", "snoozed", "due", "sent"].includes(status)) continue;
    const type = dashboardText(reminder, "reminder_type");
    const title = dashboardText(reminder, "title") || reminderLabels[type] || "Reminder";
    addEvent({
      id: `reminder-${dashboardText(reminder, "id")}`,
      productId: dashboardText(reminder, "product_id"),
      date: dashboardText(reminder, "remind_at"),
      subtitle: status === "sent" ? `${title} · notification sent` : title,
      badgeText: status === "sent" ? "Sent" : undefined,
      badgeKind: status === "sent" ? "gray" : "amber",
    });
  }

  for (const claim of collections.claims) {
    const status = dashboardText(claim, "status").replaceAll("_", " ");
    addEvent({ id: `claim-${dashboardText(claim, "id")}`, productId: dashboardText(claim, "product_id"), date: dashboardText(claim, "created_at"), subtitle: `Claim · ${status || "received"}`, badgeText: status || "Received", badgeKind: "blue" });
  }

  for (const watch of collections.watches) {
    const currentPrice = Number(watch.current_price);
    const manualPrice = Number(watch.manual_price);
    const targetPrice = Number(watch.target_price);
    const source = dashboardText(watch, "current_price_source");
    const checkStatus = dashboardText(watch, "last_check_status");
    const hasVerifiedPrice = source === "verified" && checkStatus === "verified" && Number.isFinite(currentPrice) && currentPrice > 0;
    const hasLastVerifiedPrice = source === "verified" && Number.isFinite(currentPrice) && currentPrice > 0;
    const hasManualPrice = source === "manual" && Number.isFinite(manualPrice) && manualPrice > 0;
    const reached = hasVerifiedPrice && Number.isFinite(targetPrice) && targetPrice > 0 && currentPrice <= targetPrice;
    const date = hasManualPrice
      ? dashboardText(watch, "manual_price_entered_at") || dashboardText(watch, "created_at")
      : dashboardText(watch, "last_checked_at") || dashboardText(watch, "created_at");
    const statusLabel: Record<string, string> = {
      failed: "Automated price check failed",
      unavailable: "Price unavailable",
      unsupported: "Automated checks unsupported",
      not_checked: "Price not verified",
    };
    addEvent({
      id: `watch-${dashboardText(watch, "id")}`,
      productId: dashboardText(watch, "product_id"),
      date,
      subtitle: hasVerifiedPrice
        ? `Verified price · ${dashboardCurrency(currentPrice, dashboardText(watch, "currency") || "INR")}`
        : hasLastVerifiedPrice
          ? `Last verified price · ${dashboardCurrency(currentPrice, dashboardText(watch, "currency") || "INR")}`
          : hasManualPrice
            ? `Manual price · ${dashboardCurrency(manualPrice, dashboardText(watch, "currency") || "INR")}`
            : statusLabel[checkStatus] ?? "Price watch started",
      badgeText: reached
        ? "Target reached"
        : hasVerifiedPrice
          ? "Verified"
          : hasLastVerifiedPrice
            ? "Last verified"
            : hasManualPrice
              ? "Manual"
              : checkStatus === "failed" || checkStatus === "unavailable" || checkStatus === "unsupported"
                ? "Check unavailable"
                : "Tracking",
      badgeKind: reached ? "amber" : hasVerifiedPrice ? "blue" : "gray",
    });
  }

  const today = baseDate.toISOString().slice(0, 10);
  const upcoming = events.filter((event) => event.sortDate >= today).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  const history = events.filter((event) => event.sortDate < today).sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  return [...upcoming, ...history].slice(0, 12).map((event, index) => ({
    id: event.id,
    section: index === 0 && upcoming.length > 0 ? "Upcoming" : index === upcoming.length && history.length > 0 ? "Later" : undefined,
    day: event.day,
    month: event.month,
    dotColor: event.dotColor,
    title: event.title,
    subtitle: event.subtitle,
    badgeText: event.badgeText,
    badgeKind: event.badgeKind,
    imageSrc: event.imageSrc,
  }));
}

async function loadDashboardCollection<T>(path: string, key: string): Promise<T[]> {
  const response = await fetch(path, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error("Dashboard data could not be loaded.");
  return Array.isArray(payload[key]) ? payload[key] as T[] : [];
}

interface DashboardHomeProps {
  onStartClaim: () => void;
  onOpenReview: () => void;
  onNavigateTab: (tab: string) => void;
  isSignedIn?: boolean;
  ownerKey?: string;
  isDarkTheme?: boolean;
  referenceDate?: Date | string;
}

export function DashboardHome({
  onStartClaim,
  onOpenReview,
  onNavigateTab,
  isSignedIn = false,
  ownerKey,
  referenceDate,
}: DashboardHomeProps) {
  const greeting = useGreeting();

  const baseDate = useMemo(() => {
    if (!referenceDate) return new Date();
    return typeof referenceDate === "string" ? parseDateOnly(referenceDate) : referenceDate;
  }, [referenceDate]);

  const formattedTodayDate = useMemo(() => {
    return formatCalendarDateWithWeekday(baseDate);
  }, [baseDate]);

  const previewTimelineItems = useMemo(() => {
    return createMasterTimelineData(baseDate);
  }, [baseDate]);

  const [ownerSnapshot, setOwnerSnapshot] = useState<OwnerDashboardSnapshot | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<{ ownerKey: string; message: string } | null>(null);
  const ownerRequestId = useRef(0);
  const effectiveOwnerKey = isSignedIn ? ownerKey || "signed-in" : "";

  const reloadOwnerSnapshot = useCallback(async () => {
    if (!effectiveOwnerKey) return;
    const requestId = ++ownerRequestId.current;
    setOwnerLoading(true);
    const results = await Promise.allSettled(
      dashboardCollectionEndpoints.map(([key, path]) => loadDashboardCollection<Record<string, unknown>>(path, key)),
    );
    if (requestId !== ownerRequestId.current) return;

    const [productResult, reminderResult, watchResult, claimResult] = results;
    const collections: DashboardCollections = {
      products: productResult.status === "fulfilled" ? productResult.value : [],
      reminders: reminderResult.status === "fulfilled" ? reminderResult.value : [],
      watches: watchResult.status === "fulfilled" ? watchResult.value : [],
      claims: claimResult.status === "fulfilled" ? claimResult.value : [],
    };
    setOwnerSnapshot({
      ownerKey: effectiveOwnerKey,
      products: collections.products.map((row) => dashboardProductFromRow(row, baseDate)).filter((product): product is ProductCardItem => product !== null),
      timeline: dashboardTimelineFromRows(collections, baseDate),
    });
    setOwnerError(results.some((result) => result.status === "rejected")
      ? { ownerKey: effectiveOwnerKey, message: "Some saved activity could not be refreshed. Try again to see the latest updates." }
      : null);
    setOwnerLoading(false);
  }, [baseDate, effectiveOwnerKey]);

  useEffect(() => {
    if (!effectiveOwnerKey) return;

    let active = true;
    const load = () => {
      if (active) void reloadOwnerSnapshot();
    };
    load();
    window.addEventListener("focus", load);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      ownerRequestId.current += 1;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [effectiveOwnerKey, reloadOwnerSnapshot]);

  const currentOwnerSnapshot = ownerSnapshot?.ownerKey === effectiveOwnerKey ? ownerSnapshot : null;
  const currentOwnerError = ownerError?.ownerKey === effectiveOwnerKey ? ownerError.message : "";
  const timelineItems = isSignedIn ? currentOwnerSnapshot?.timeline ?? emptyDashboardTimeline : previewTimelineItems;
  const dashboardProducts = isSignedIn ? currentOwnerSnapshot?.products ?? emptyDashboardProducts : masterDashboardProducts;

  const [tasks, setTasks] = useState<TodayTaskItem[]>(() => createTodayTasks(baseDate));
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<ProductCardItem | null>(null);

  // Product categories are derived from the signed-in user's saved records.
  const categoryCounts = useMemo(
    () => ({
      All: dashboardProducts.length,
      Electronics: dashboardProducts.filter((p) => p.category === "Electronics").length,
      Appliances: dashboardProducts.filter((p) => p.category === "Appliances").length,
      "Personal Care": dashboardProducts.filter((p) => p.category === "Personal Care").length,
      Accessories: dashboardProducts.filter((p) => p.category === "Accessories").length,
    }),
    [dashboardProducts]
  );

  // Scroll-linked beam progress for dashboard timeline rail
  const dashboardScrollRef = useRef<HTMLDivElement>(null);
  const [dashboardBeamProgress, setDashboardBeamProgress] = useState(0);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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

  const filteredProducts = dashboardProducts.filter((product) => {
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
                  <span>{formattedTodayDate}</span>
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
              {/* Row 1 — Section identity and view controls */}
              <div className="products-header-top-row">
                <div className="products-title-group">
                  <TechHeading
                    variant="section"
                    as="h2"
                    id="products-section-title"
                    className="products-section-heading"
                    text="Your Products"
                    fontSize={22}
                    height={36}
                    suffix={<span className="products-count-num">({filteredProducts.length})</span>}
                  />
                </div>

                <div className="products-view-toggle" role="group" aria-label="View mode">
                  <button
                    type="button"
                    className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    title="List view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>

              {/* Row 2 — Category filters */}
              <div className="products-filter-strip" role="toolbar" aria-label="Category filters">
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "All" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("All")}
                >
                  All ({categoryCounts.All})
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Electronics" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Electronics")}
                >
                  Electronics ({categoryCounts.Electronics})
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Appliances" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Appliances")}
                >
                  Appliances ({categoryCounts.Appliances})
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Personal Care" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Personal Care")}
                >
                  Personal Care ({categoryCounts["Personal Care"]})
                </button>
                <button
                  type="button"
                  className={`category-pill-btn ${selectedCategory === "Accessories" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("Accessories")}
                >
                  Accessories ({categoryCounts.Accessories})
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
            </div>

            {/* 4-Column Product Grid */}
            <div
              className={`products-container-layout ${
                viewMode === "grid" ? "quad-grid" : "list-layout"
              }`}
            >
              {isSignedIn && ownerLoading && filteredProducts.length === 0 ? (
                <p role="status" className="dashboard-data-status">Loading your products…</p>
              ) : null}
              {isSignedIn && !ownerLoading && filteredProducts.length === 0 ? (
                <div className="dashboard-data-status">
                  <p>{currentOwnerError || "Your saved products will appear here."}</p>
                  {currentOwnerError ? <button type="button" onClick={() => void reloadOwnerSnapshot()}>Retry</button> : null}
                  {!currentOwnerError ? <button type="button" onClick={() => onNavigateTab("add-product")}>Add your first product</button> : null}
                </div>
              ) : null}
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
                    {dashboardProductImage(product, "product-cutout-img")}
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
                      <span>{product.documentCount === undefined ? "Open passport" : `${product.documentCount} ${product.documentCount === 1 ? "document" : "documents"}`}</span>
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
                {isSignedIn && ownerLoading && timelineItems.length === 0 ? <p role="status" className="dashboard-data-status">Loading your timeline…</p> : null}
                {isSignedIn && currentOwnerError ? (
                  <div role="alert" className="dashboard-data-status">
                    <p>{currentOwnerError}</p>
                    <button type="button" onClick={() => void reloadOwnerSnapshot()}>Retry</button>
                  </div>
                ) : null}
                {isSignedIn && !ownerLoading && !currentOwnerError && timelineItems.length === 0 ? (
                  <p className="dashboard-data-status">Add a product or reminder to start your timeline.</p>
                ) : null}
                {timelineItems.map((item) => (
                  <React.Fragment key={item.id}>
                    {item.section && (
                      <div className="timeline-section-divider">
                        <span className="section-pill-tag">{item.section}</span>
                      </div>
                    )}
                    <div
                      className="timeline-event-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title}: ${item.subtitle}. Open timeline`}
                      onClick={() => onNavigateTab("timeline")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onNavigateTab("timeline");
                        }
                      }}
                    >
                      <div className="event-date-col">
                        <span className="event-day-number">{item.day}</span>
                        <span className="event-month-text">{item.month}</span>
                      </div>

                      <div
                        className="event-node-dot"
                        style={{ backgroundColor: item.dotColor }}
                      />

                      <div className="event-thumb-wrap">
                        {item.imageSrc ? <img src={item.imageSrc} alt="" className="timeline-event-thumb-img" loading="lazy" /> : <Package size={18} aria-hidden="true" />}
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
                  {dashboardProductImage(selectedProduct, "passport-cutout-img")}
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
                  <span className="field-value font-medium">{selectedProduct.categoryLabel ?? selectedProduct.category}</span>
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
              {selectedProduct.invoiceName ? <div className="passport-document-card">
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
              </div> : null}

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
