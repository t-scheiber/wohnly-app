#!/usr/bin/env node
/**
 * WCAG contrast checker for the Wohnly theme.
 * Usage: node scripts/check-contrast.mjs
 * Exits non-zero if any checked pair fails its WCAG AA threshold.
 */

function srgb(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Keep in sync with constants/Colors.ts
const light = {
  primary: "#2e7d6e",
  primaryForeground: "#ffffff",
  accent: "#c05237",
  accentForeground: "#ffffff",
  background: "#faf8f5",
  card: "#ffffff",
  text: "#2d3a3a",
  textSecondary: "#5a6f6f",
  inputBorder: "#7a9191",
  muted: "#f0f5f3",
  destructive: "#c05237",
  destructiveForeground: "#ffffff",
  success: "#2e7d6e",
  warning: "#a34d28",
};

const dark = {
  primary: "#7bc4b6",
  primaryForeground: "#10201d",
  accent: "#f0967f",
  accentForeground: "#33150c",
  background: "#1a2626",
  card: "#243333",
  text: "#f0f5f3",
  textSecondary: "#a8c0b9",
  inputBorder: "#6a8a8a",
  muted: "#243333",
  destructive: "#f0967f",
  destructiveForeground: "#33150c",
  success: "#7bc4b6",
  warning: "#f0967f",
};

// [foreground, background, minimum ratio, description]
function pairs(t, scheme) {
  return [
    [t.text, t.background, 4.5, `${scheme}: text on background`],
    [t.text, t.card, 4.5, `${scheme}: text on card`],
    [t.text, t.muted, 4.5, `${scheme}: text on muted`],
    [t.textSecondary, t.background, 4.5, `${scheme}: secondary text on background`],
    [t.textSecondary, t.card, 4.5, `${scheme}: secondary text on card`],
    [t.primaryForeground, t.primary, 4.5, `${scheme}: button label on primary`],
    [t.accentForeground, t.accent, 4.5, `${scheme}: label on accent`],
    [t.primary, t.background, 3.0, `${scheme}: primary UI element on background`],
    [t.destructive, t.background, 3.0, `${scheme}: destructive UI element on background`],
    [t.destructive, t.card, 4.5, `${scheme}: destructive text on card`],
    [t.success, t.card, 3.0, `${scheme}: success UI element on card`],
    [t.warning, t.card, 4.5, `${scheme}: warning text on card`],
    [t.inputBorder, t.card, 3.0, `${scheme}: input border on card`],
    [t.inputBorder, t.background, 3.0, `${scheme}: input border on background`],
    [t.destructiveForeground, t.destructive, 4.5, `${scheme}: label on destructive`],
  ];
}

let failed = 0;
for (const [fg, bg, min, label] of [...pairs(light, "light"), ...pairs(dark, "dark")]) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (min ${min}:1)`
  );
}

if (failed > 0) {
  console.error(`\n${failed} contrast pair(s) below WCAG AA threshold`);
  process.exit(1);
} else {
  console.log("\nAll checked pairs meet WCAG AA");
}
