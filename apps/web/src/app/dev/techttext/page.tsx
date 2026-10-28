"use client";

import React, { useState } from "react";
import Link from "next/link";
import TechText from "@/components/TechText";
import { ArrowLeft, RefreshCw, Sliders } from "lucide-react";

export default function TechTextDevPreviewPage() {
  const [introKey, setIntroKey] = useState(0);
  const [currentIntro, setCurrentIntro] = useState<"assemble" | "metrics" | "type" | "none">("assemble");
  const [sweep, setSweep] = useState(true);
  const [guides, setGuides] = useState(true);
  const [labels, setLabels] = useState(true);
  const [specks] = useState(15);
  const [accentColor, setAccentColor] = useState("#EA580C");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAF8F5", color: "#1C1917", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Navigation & Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 9999,
                background: "#EBE6DE",
                color: "#44403C",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={16} /> Return to App
            </Link>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
                React Bits TechText — Development Verification Studio
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716C" }}>
                Step 1 Verification: Isolated 100px Canvas with character dragging, assemble intro, guides &amp; dashed vector reveals.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setIntroKey((k) => k + 1)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                background: "#1C1917",
                color: "#FAF8F5",
                borderRadius: 8,
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Replay Intro
            </button>
          </div>
        </div>

        {/* Studio Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            background: "#FFFFFF",
            border: "1px solid #E7E5E4",
            borderRadius: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 700, color: "#1C1917", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Sliders size={15} color="#EA580C" /> Intro Mode:
          </span>
          {(["assemble", "metrics", "type", "none"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setCurrentIntro(kind);
                setIntroKey((k) => k + 1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: currentIntro === kind ? "#EA580C" : "#E7E5E4",
                background: currentIntro === kind ? "#FFF7ED" : "#FFFFFF",
                color: currentIntro === kind ? "#C2410C" : "#44403C",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {kind}
            </button>
          ))}

          <span style={{ margin: "0 8px", width: 1, height: 18, background: "#E7E5E4" }} />

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={sweep} onChange={(e) => setSweep(e.target.checked)} />
            Ambient Sweep
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            Technical Guides
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            Metrics Labels
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ width: 24, height: 24, border: "none", cursor: "pointer", borderRadius: 4 }}
            />
            Accent: {accentColor}
          </label>
        </div>

        {/* Step 1: 100px Isolated Canvas */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E7E5E4",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", letterSpacing: "0.08em" }}>
                STEP 1 MANDATORY BENCHMARK
              </span>
              <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
                100px Canvas — Full Feature Demonstration
              </h2>
            </div>
            <div style={{ fontSize: 12, color: "#78716C" }}>
              Try hovering, clicking letters to trigger elastic kick, or dragging characters around!
            </div>
          </div>

          <div
            id="techttext-large-stage"
            key={introKey}
            style={{
              width: "100%",
              height: 420,
              background: "#FDFCFA",
              border: "1px dashed #DDD7CD",
              borderRadius: 12,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <TechText
              text="ProductVault"
              fontSize={100}
              fontWeight={700}
              letterSpacing={-0.03}
              color="#292522"
              accentColor={accentColor}
              align="center"
              reveal="letter"
              intro={currentIntro}
              introDuration={1.8}
              reach={200}
              softness={0.7}
              dashLength={4}
              dashGap={2}
              strokeWidth={2}
              selection={true}
              labels={labels}
              guides={guides}
              specks={specks}
              draggable={true}
              clickKick={true}
              bounce={0.4}
              sweep={sweep}
              speed={1}
              charColor={(_char: string, i: number) => (i < 7 ? "#292522" : accentColor)}
            />
          </div>
        </div>

        {/* Step 3: Exact Navbar Simulation Preview */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E7E5E4",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", letterSpacing: "0.08em" }}>
              STEP 3 NAVBAR TUNED PREVIEW
            </span>
            <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
              Navbar Simulation (36px Typography with Isometric Cube Logo)
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716C" }}>
              Notice how the letters transform cleanly into warm orange dashed vector outlines on hover without layout distortion.
            </p>
          </div>

          {/* Simulated 64px Top Navbar */}
          <div
            style={{
              height: 64,
              backgroundColor: "rgba(250, 248, 245, 0.95)",
              border: "1px solid #E5DFD7",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 16,
            }}
          >
            {/* SVG Logo Cube */}
            <svg style={{ width: 36, height: 36, flexShrink: 0 }} viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="demo-cf-top" x1="20" y1="2" x2="36" y2="12" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FB923C" />
                  <stop offset="1" stopColor="#EA580C" />
                </linearGradient>
                <linearGradient id="demo-cf-left" x1="4" y1="12" x2="20" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#EA580C" />
                  <stop offset="1" stopColor="#C2410C" />
                </linearGradient>
                <linearGradient id="demo-cf-right" x1="20" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F97316" />
                  <stop offset="1" stopColor="#9A3412" />
                </linearGradient>
              </defs>
              <polygon points="20,3 36,12 20,21 4,12" fill="url(#demo-cf-top)" />
              <polygon points="4,12 20,21 20,37 4,28" fill="url(#demo-cf-left)" />
              <polygon points="20,21 36,12 36,28 20,37" fill="url(#demo-cf-right)" />
              <path d="M20 21L20 37" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" />
              <path d="M4 12L20 21L36 12" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" />
              <path d="M12 7.5L28 16.5" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.3" />
            </svg>

            {/* Navbar TechText container (236px x 54px for 36px font) */}
            <div style={{ width: 236, height: 54, display: "flex", alignItems: "center" }}>
              <TechText
                text="ProductVault"
                fontSize={36}
                fontWeight={700}
                letterSpacing={-0.025}
                color="#292522"
                accentColor="#EA580C"
                align="left"
                reveal="letter"
                intro="none"
                reach={85}
                softness={0.65}
                dashLength={3}
                dashGap={2}
                strokeWidth={1.8}
                selection={true}
                labels={false}
                guides={false}
                specks={3}
                draggable={false}
                clickKick={false}
                bounce={0.12}
                sweep={false}
                speed={1}
                charColor={(_char: string, i: number) => (i < 7 ? "#292522" : "#EA580C")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
