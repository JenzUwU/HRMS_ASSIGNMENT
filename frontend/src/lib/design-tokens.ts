/**
 * Design tokens mirrored for JS consumers (Recharts, inline styles, canvas).
 * Source of truth for CSS is globals.css @theme. Keep both in sync.
 */
export const colors = {
  orange: "#FC8019",
  charcoal: "#2B2520",
  cream: "#FFF8F2",
  peach: "#FFE4D0",
  teal: "#2FA58D",
  coral: "#E85D4A",
  textPrimary: "#292929",
  textSecondary: "#747474",
  border: "#F0E6DD",
  warning: "#F2A516",
} as const;

export const fonts = {
  heading: "var(--font-sora), sans-serif",
  body: "var(--font-inter), sans-serif",
} as const;

export const riskColors = {
  High: colors.coral,
  Medium: colors.warning,
  Low: colors.teal,
} as const;
