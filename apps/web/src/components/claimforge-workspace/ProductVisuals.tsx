import React from "react";

export function ClaimForgeLogoMark({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cf-top" x1="20" y1="2" x2="36" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="cf-left" x1="4" y1="12" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EA580C" />
          <stop offset="1" stopColor="#C2410C" />
        </linearGradient>
        <linearGradient id="cf-right" x1="20" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#9A3412" />
        </linearGradient>
      </defs>
      {/* 3D Isometric Cube */}
      <polygon points="20,3 36,12 20,21 4,12" fill="url(#cf-top)" />
      <polygon points="4,12 20,21 20,37 4,28" fill="url(#cf-left)" />
      <polygon points="20,21 36,12 36,28 20,37" fill="url(#cf-right)" />
      {/* Stylized box opening flap lines */}
      <path d="M20 21L20 37" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" />
      <path d="M4 12L20 21L36 12" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" />
      <path d="M12 7.5L28 16.5" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}

export function HeroBoxIllustration({ className = "w-44 h-36" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="soft-shadow" x="10" y="70" width="160" height="70" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="8" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.45 0 0 0 0 0.2  0 0 0 0.2 0" />
        </filter>
        <linearGradient id="box-front" x1="45" y1="55" x2="135" y2="125" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDBA74" />
          <stop offset="0.6" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="shield-grad" x1="90" y1="70" x2="90" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* Ambient shadow */}
      <ellipse cx="90" cy="115" rx="65" ry="16" fill="url(#soft-shadow)" />

      {/* Floating Documents behind box */}
      <g transform="rotate(-12 60 40)">
        <rect x="35" y="10" width="46" height="60" rx="4" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
        <line x1="42" y1="22" x2="73" y2="22" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="42" y1="30" x2="68" y2="30" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="38" x2="70" y2="38" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="46" x2="60" y2="46" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        <circle cx="68" cy="55" r="4" fill="#10B981" />
      </g>
      <g transform="rotate(8 115 35)">
        <rect x="95" y="12" width="48" height="62" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
        <line x1="103" y1="24" x2="135" y2="24" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="103" y1="32" x2="128" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <line x1="103" y1="40" x2="132" y2="40" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        <line x1="103" y1="48" x2="120" y2="48" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* 3D Box Body */}
      {/* Left Back Flap */}
      <polygon points="35,50 68,36 90,52 50,62" fill="#F97316" opacity="0.9" />
      {/* Right Back Flap */}
      <polygon points="145,50 112,36 90,52 130,62" fill="#EA580C" opacity="0.9" />

      {/* Front Face of Box */}
      <path d="M40 60 L90 75 L140 60 L140 108 C140 112 136 115 132 116 L90 125 L48 116 C44 115 40 112 40 108 Z" fill="url(#box-front)" />
      
      {/* Open Front Flaps */}
      <polygon points="40,60 18,72 58,82 90,75" fill="#FDBA74" />
      <polygon points="140,60 162,72 122,82 90,75" fill="#FB923C" />

      {/* Box Tape / Seam */}
      <path d="M90 75 L90 125" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

      {/* Shield Emblem on Box */}
      <g filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))">
        <path d="M90 80 C99 80 106 82 106 88 C106 98 90 108 90 108 C90 108 74 98 74 88 C74 82 81 80 90 80 Z" fill="url(#shield-grad)" />
        {/* Shield Checkmark */}
        <path d="M83 89 L88 94 L97 85" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Floating sparkles */}
      <circle cx="28" cy="40" r="2" fill="#F97316" />
      <circle cx="152" cy="35" r="2.5" fill="#38BDF8" />
      <circle cx="162" cy="55" r="1.5" fill="#F59E0B" />
    </svg>
  );
}

// 1. Sony WH-1000XM5 Headphone Icon / Visual
export function HeadphoneThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Background circle */}
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Headband */}
      <path d="M22 42 C22 22 58 22 58 42" stroke="#1E293B" strokeWidth="5.5" strokeLinecap="round" />
      {/* Adjustment stems */}
      <line x1="22" y1="40" x2="22" y2="46" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      <line x1="58" y1="40" x2="58" y2="46" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      {/* Ear cups */}
      <rect x="16" y="44" width="12" height="20" rx="6" fill="#0F172A" />
      <rect x="52" y="44" width="12" height="20" rx="6" fill="#0F172A" />
      {/* Soft cushion inner */}
      <rect x="18" y="47" width="4" height="14" rx="2" fill="#334155" />
      <rect x="58" y="47" width="4" height="14" rx="2" fill="#334155" />
    </svg>
  );
}

// 2. LG Refrigerator Visual
export function RefrigeratorThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Refrigerator body */}
      <rect x="25" y="16" width="30" height="48" rx="4" fill="#94A3B8" stroke="#64748B" strokeWidth="1.5" />
      {/* Top Door (Freezer) */}
      <rect x="26.5" y="17.5" width="27" height="17" rx="2.5" fill="#E2E8F0" />
      {/* Bottom Door */}
      <rect x="26.5" y="36.5" width="27" height="26" rx="2.5" fill="#CBD5E1" />
      {/* Door handles */}
      <line x1="29" y1="28" x2="29" y2="33" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <line x1="29" y1="38" x2="29" y2="46" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      {/* Water / Ice dispenser */}
      <rect x="42" y="41" width="7" height="9" rx="1.5" fill="#64748B" />
      {/* Brand badge */}
      <circle cx="40" cy="21" r="1.5" fill="#EF4444" />
    </svg>
  );
}

// 3. Titan Analog Watch Visual
export function WatchThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Leather strap top & bottom */}
      <rect x="33" y="12" width="14" height="16" rx="2" fill="#78350F" />
      <rect x="33" y="52" width="14" height="16" rx="2" fill="#78350F" />
      {/* Stitch lines */}
      <line x1="35" y1="13" x2="35" y2="26" stroke="#92400E" strokeDasharray="1.5 1.5" strokeWidth="1" />
      <line x1="45" y1="13" x2="45" y2="26" stroke="#92400E" strokeDasharray="1.5 1.5" strokeWidth="1" />
      <line x1="35" y1="54" x2="35" y2="67" stroke="#92400E" strokeDasharray="1.5 1.5" strokeWidth="1" />
      <line x1="45" y1="54" x2="45" y2="67" stroke="#92400E" strokeDasharray="1.5 1.5" strokeWidth="1" />
      {/* Bezel Gold Ring */}
      <circle cx="40" cy="40" r="17" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
      {/* Watch Dial White */}
      <circle cx="40" cy="40" r="14" fill="#FFFBEB" />
      {/* Crown */}
      <rect x="57" y="38" width="3" height="4" rx="1" fill="#D97706" />
      {/* Dial ticks */}
      <line x1="40" y1="28" x2="40" y2="30" stroke="#78350F" strokeWidth="1.5" />
      <line x1="40" y1="50" x2="40" y2="52" stroke="#78350F" strokeWidth="1.5" />
      <line x1="28" y1="40" x2="30" y2="40" stroke="#78350F" strokeWidth="1.5" />
      <line x1="50" y1="40" x2="52" y2="40" stroke="#78350F" strokeWidth="1.5" />
      {/* Hands */}
      <line x1="40" y1="40" x2="40" y2="32" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="40" x2="46" y2="40" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="40" cy="40" r="1.5" fill="#EF4444" />
    </svg>
  );
}

// 4. Minimalist Sunscreen Visual
export function SunscreenThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Squeeze Tube Body */}
      <path d="M28 22 C28 20 52 20 52 22 L49 54 L31 54 Z" fill="#FBBF24" />
      {/* Crimped top seam */}
      <rect x="28" y="19" width="24" height="4" rx="1" fill="#D97706" />
      {/* Cap */}
      <rect x="33" y="54" width="14" height="8" rx="2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1" />
      {/* Text on tube */}
      <rect x="33" y="30" width="14" height="2.5" rx="1" fill="#1F2937" />
      <rect x="35" y="35" width="10" height="1.5" rx="0.75" fill="#4B5563" />
      <rect x="34" y="42" width="12" height="4" rx="1" fill="#EA580C" />
      <circle cx="40" cy="44" r="1" fill="#FFFFFF" />
    </svg>
  );
}

// 5. Nike Air Max 270 Sneaker Visual
export function SneakerThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Sole */}
      <path d="M18 53 C22 53 28 54 36 54 C48 54 58 53 62 50 C62 53 58 56 46 56 C32 56 20 56 18 53 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      {/* Air Max 270 visible heel bubble */}
      <ellipse cx="54" cy="50" rx="7" ry="4" fill="#38BDF8" opacity="0.8" />
      {/* Sneaker Upper */}
      <path d="M18 51 C19 46 25 43 32 43 C38 43 43 38 46 32 C48 30 52 31 53 35 L55 42 C58 43 62 46 62 50 Z" fill="#0F172A" />
      {/* Swoosh */}
      <path d="M35 44 C38 45 42 45 45 42 C43 44 38 46 34 45 Z" fill="#FFFFFF" />
      {/* Laces */}
      <line x1="38" y1="38" x2="42" y2="39" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="41" y1="35" x2="45" y2="36" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 6. iPhone 15 Visual
export function PhoneThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Phone chassis */}
      <rect x="28" y="16" width="24" height="48" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
      {/* Screen */}
      <rect x="30" y="18" width="20" height="44" rx="4" fill="#0284C7" />
      {/* Dynamic island pill */}
      <rect x="37" y="20" width="6" height="2" rx="1" fill="#000000" />
      {/* Home bar */}
      <rect x="37" y="58" width="6" height="1" rx="0.5" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

// 7. MacBook Air M2 Visual
export function LaptopThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Screen lid */}
      <rect x="22" y="24" width="36" height="24" rx="3" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
      {/* Screen display gradient */}
      <rect x="24" y="26" width="32" height="20" rx="1.5" fill="#3B82F6" />
      {/* Base keyboard deck */}
      <path d="M16 48 L64 48 L60 54 L20 54 Z" fill="#94A3B8" stroke="#475569" strokeWidth="1.2" />
      {/* Trackpad notch */}
      <rect x="36" y="49" width="8" height="2" rx="1" fill="#64748B" />
    </svg>
  );
}

// 8. Ergonomic Office Chair Visual
export function OfficeChairThumb({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#F1F5F9" className="thumb-bg" />
      {/* Headrest */}
      <rect x="34" y="12" width="12" height="5" rx="2.5" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <line x1="40" y1="17" x2="40" y2="20" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      {/* High Mesh Backrest */}
      <path d="M30 20 C30 18 50 18 50 20 L48 42 C48 44 32 44 32 42 Z" fill="#334155" stroke="#1E293B" strokeWidth="1.5" />
      <line x1="33" y1="26" x2="47" y2="26" stroke="#475569" strokeWidth="1" strokeDasharray="1.5 1.5" />
      <line x1="33" y1="32" x2="47" y2="32" stroke="#475569" strokeWidth="1" strokeDasharray="1.5 1.5" />
      <line x1="34" y1="38" x2="46" y2="38" stroke="#475569" strokeWidth="1" strokeDasharray="1.5 1.5" />
      {/* Armrests */}
      <path d="M25 32 L29 32 L29 42" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 32 L51 32 L51 42" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Seat Cushion */}
      <rect x="27" y="43" width="26" height="7" rx="3.5" fill="#0F172A" />
      {/* Central Cylinder Post */}
      <rect x="38" y="50" width="4" height="9" fill="#64748B" />
      {/* 5-Star Caster Base Legs */}
      <path d="M40 59 L26 67" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 59 L54 67" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 59 L40 68" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 59 L31 64" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 59 L49 64" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      {/* Wheels */}
      <circle cx="26" cy="68" r="1.8" fill="#0F172A" />
      <circle cx="54" cy="68" r="1.8" fill="#0F172A" />
      <circle cx="40" cy="69" r="1.8" fill="#0F172A" />
    </svg>
  );
}

