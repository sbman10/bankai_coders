"use client";

import React, { ElementType, ReactNode } from "react";
import TechText from "./TechText";
import "./TechHeading.css";

export type TechHeadingVariant = "brand" | "page" | "section";

export interface TechHeadingProps {
  /** Visual variant: brand (navbar wordmark), page (main page title), section (widget heading) */
  variant?: TechHeadingVariant;
  /** Semantic HTML tag for accessibility and SEO */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div";
  /** The text to animate with TechText */
  text: string;
  /** Content to render immediately following the canvas (e.g., badges, counts, emojis) */
  suffix?: ReactNode;
  /** Content to render immediately preceding the canvas (e.g., icons) */
  prefix?: ReactNode;
  /** Custom font size in pixels */
  fontSize?: number;
  /** Font weight */
  fontWeight?: number;
  /** Text color at rest */
  color?: string;
  /** Technical accent color for dashed strokes and selection frame */
  accentColor?: string;
  /** Optional per-character color function (e.g. ProductVault two-tone branding) */
  charColor?: (char: string, index: number) => string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Optional intro animation: "none" | "assemble" | "type" | "metrics" */
  intro?: "none" | "assemble" | "type" | "metrics";
  /** Intro animation duration in seconds */
  introDuration?: number;
  /** Show technical selection frame on letter hover */
  selection?: boolean;
  /** Number of technical specks */
  specks?: number;
  /** Stroke width for dashed vector outlines */
  strokeWidth?: number;
  /** Dash length */
  dashLength?: number;
  /** Dash gap */
  dashGap?: number;
  /** Autonomous sweep across characters (default false to prevent constant CPU usage) */
  sweep?: boolean;
  /** Container height in px or string */
  height?: number | string;
  /** Container width in px or string */
  width?: number | string;
  /** Wrapper class name */
  className?: string;
  /** Wrapper inline style */
  style?: React.CSSProperties;
  /** Accessible DOM id */
  id?: string;
  /** Accessible aria-label override */
  ariaLabel?: string;
  "aria-label"?: string;
}

export function TechHeading({
  variant = "section",
  as,
  text,
  suffix,
  prefix,
  fontSize,
  fontWeight,
  color,
  accentColor = "#EA580C",
  charColor,
  align = "left",
  intro = "none",
  introDuration = 1.5,
  selection = true,
  specks,
  strokeWidth,
  dashLength,
  dashGap,
  sweep = false,
  height,
  width,
  className = "",
  style,
  id,
  ariaLabel,
  "aria-label": ariaLabelAttr,
}: TechHeadingProps) {
  // Determine variant defaults
  const resolvedTag: ElementType =
    as || (variant === "page" ? "h1" : variant === "brand" ? "span" : "h2");

  let defaultFontSize = 22;
  let defaultHeight = 36;
  let defaultSpecks = 4;
  let defaultStrokeWidth = 1.8;

  if (variant === "brand") {
    defaultFontSize = 35;
    defaultHeight = 52;
    defaultSpecks = 4;
    defaultStrokeWidth = 1.8;
  } else if (variant === "page") {
    defaultFontSize = 38;
    defaultHeight = 56;
    defaultSpecks = 8;
    defaultStrokeWidth = 2.0;
  }

  const finalFontSize = fontSize ?? defaultFontSize;
  const finalHeight = height ?? defaultHeight;
  const finalSpecks = specks ?? defaultSpecks;
  const finalStrokeWidth = strokeWidth ?? defaultStrokeWidth;

  // Auto-calculate width if not provided: ~0.64em per character + padding
  const autoWidth =
    width ?? Math.ceil(text.length * finalFontSize * 0.65 + 24);

  const Tag = resolvedTag;
  const resolvedAria = ariaLabel ?? ariaLabelAttr;

  return (
    <Tag
      id={id}
      aria-label={resolvedAria}
      className={`tech-heading tech-heading-${variant} ${className}`.trim()}
      style={style}
    >
      {prefix && <span className="tech-heading-prefix">{prefix}</span>}
      <span className="sr-only">{text}</span>
      <div
        className="tech-heading-canvas-wrap"
        style={{
          height: finalHeight,
          width: autoWidth,
        }}
        aria-hidden="true"
      >
        <TechText
          text={text}
          fontSize={finalFontSize}
          fontWeight={fontWeight ?? 700}
          letterSpacing={-0.025}
          color={color ?? "currentColor"}
          accentColor={accentColor}
          charColor={charColor}
          align={align}
          reveal="letter"
          intro={intro}
          introDuration={introDuration}
          selection={selection}
          specks={finalSpecks}
          strokeWidth={finalStrokeWidth}
          dashLength={dashLength ?? 3}
          dashGap={dashGap ?? 2}
          draggable={false}
          clickKick={false}
          bounce={0.14}
          sweep={sweep}
          speed={1}
          guides={false}
          labels={false}
        />
      </div>
      {suffix && <span className="tech-heading-suffix">{suffix}</span>}
    </Tag>
  );
}

export default TechHeading;
