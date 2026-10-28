"use client";

import React from "react";
import Link from "next/link";
import { Timeline, TimelineEntry } from "@/components/ui/timeline";
import { ArrowLeft } from "lucide-react";

export default function TimelineBenchmarkPage() {
  const data: TimelineEntry[] = [
    {
      title: "2024",
      content: (
        <div>
          <p className="benchmark-para">
            Built and launched Aceternity UI and Aceternity UI Pro from scratch
          </p>
          <div className="benchmark-grid">
            <div className="benchmark-card">Startup Template 1 · Aceternity UI Core</div>
            <div className="benchmark-card">Startup Template 2 · Production Deployment</div>
            <div className="benchmark-card">Startup Template 3 · Motion Animation System</div>
            <div className="benchmark-card">Startup Template 4 · Component Architecture</div>
          </div>
        </div>
      ),
    },
    {
      title: "Early 2023",
      content: (
        <div>
          <p className="benchmark-para">
            Scroll-linked progress animations and sticky chronological headers reference design.
          </p>
          <div className="benchmark-grid">
            <div className="benchmark-card">Hero Sections &amp; Sticky Nav</div>
            <div className="benchmark-card">Bento Grids &amp; Micro-interactions</div>
            <div className="benchmark-card">Scroll-following Rail Mechanics</div>
            <div className="benchmark-card">Interactive Ownership Journal</div>
          </div>
        </div>
      ),
    },
    {
      title: "Changelog",
      content: (
        <div>
          <p className="benchmark-para">
            Deployed verified Aceternity Timeline reference interaction benchmark.
          </p>
          <ul className="benchmark-list">
            <li>✅ Continuous vertical timeline rail</li>
            <li>✅ Circular marker nodes centered on the rail</li>
            <li>✅ Scroll-following burnt-orange beam with heightTransform</li>
            <li>✅ Sticky header behavior as container traverses viewport</li>
            <li>✅ Reversible progress animation when scrolling upwards</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "200vh", backgroundColor: "#FAF8F5", color: "#1C1917", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Navigation & Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
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
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#EA580C", textTransform: "uppercase" }}>
                Development Reference Benchmark
              </span>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: "2px 0 0", color: "#1C1917" }}>
                Aceternity Timeline Isolated Preview
              </h1>
            </div>
          </div>
        </div>

        {/* The Authentic Aceternity Timeline */}
        <Timeline data={data} />
      </div>

      <style jsx>{`
        .benchmark-para {
          margin: 0 0 16px 0;
          font-size: 0.9375rem;
          color: #57534E;
          line-height: 1.6;
        }
        .benchmark-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .benchmark-card {
          background: #FFFFFF;
          border: 1px solid #E8DFD5;
          border-radius: 8px;
          padding: 14px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #292524;
          box-shadow: 0 1px 3px rgba(44, 39, 34, 0.04);
        }
        .benchmark-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.875rem;
          color: #292524;
        }
      `}</style>
    </div>
  );
}
