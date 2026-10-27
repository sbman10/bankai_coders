"use client";

import React, { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TimelineDateInfo {
  day: string;
  month: string;
  year: string;
  formatted: string;
}

export interface TimelineEntry {
  title: string;
  content: React.ReactNode;
  id?: string;
  date?: TimelineDateInfo;
  yearChapter?: string;
  statusBadge?: React.ReactNode;
  nodeIcon?: React.ReactNode;
  nodeColor?: string;
}

export interface TimelineProps {
  data: TimelineEntry[];
  className?: string;
  activeColor?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  data,
  className,
  activeColor = "#EA580C",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [data]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      if (ref.current) {
        setHeight(ref.current.getBoundingClientRect().height);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 75%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  return (
    <div
      ref={containerRef}
      className={cn("aceternity-timeline-container relative w-full", className)}
      style={{ isolation: "isolate" }}
    >
      <div ref={ref} className="aceternity-timeline-body relative max-w-5xl mx-auto pb-16">
        {data.map((item, index) => {
          return (
            <React.Fragment key={item.id || index}>
              {/* Secondary Year Chapter Divider */}
              {item.yearChapter && (
                <div className="timeline-year-chapter" data-testid="timeline-year-chapter">
                  <div className="timeline-year-badge">
                    <span>{item.yearChapter}</span>
                  </div>
                  <div className="timeline-year-line" />
                </div>
              )}

              <div className="aceternity-timeline-entry group">
                {/* Left Column: Sticky Date or Title */}
                <div className="aceternity-timeline-sticky-date">
                  {item.date ? (
                    <div className="timeline-date-display" data-testid="timeline-date-chip">
                      <span className="timeline-day-num">{item.date.day}</span>
                      <div className="timeline-month-year-wrap">
                        <span className="timeline-month-txt">{item.date.month}</span>
                        <span className="timeline-year-txt">{item.date.year}</span>
                      </div>
                    </div>
                  ) : (
                    <h3 className="timeline-title-display">{item.title}</h3>
                  )}

                  {/* Discrete Status Badge (never concatenated to date string) */}
                  {item.statusBadge && (
                    <div className="timeline-status-badge-wrap">
                      {item.statusBadge}
                    </div>
                  )}
                </div>

                {/* Center Column: Circular Marker Centered on Continuous Rail */}
                <div className="aceternity-timeline-node-slot">
                  <div
                    className="aceternity-node-circle"
                    style={{
                      borderColor: item.nodeColor ? `${item.nodeColor}40` : undefined,
                    }}
                  >
                    <div
                      className="aceternity-node-dot"
                      style={{
                        backgroundColor: item.nodeColor || activeColor,
                      }}
                    >
                      {item.nodeIcon || <div className="aceternity-node-core" />}
                    </div>
                  </div>
                </div>

                {/* Right Column: Consistent Event Content Card */}
                <div className="aceternity-timeline-content-col">
                  {item.content}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* The Continuous Rail & Animated Scroll-Following Beam */}
        <div
          style={{ height: height > 0 ? `${height}px` : "100%" }}
          className="aceternity-timeline-rail-track"
          aria-hidden="true"
          suppressHydrationWarning
        >
          {/* Static neutral continuous track */}
          <div className="aceternity-rail-bg" />

          {/* Dynamic Scroll-Following Burnt-Orange Beam */}
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="aceternity-rail-beam"
          />
        </div>
      </div>
    </div>
  );
};
