export const colors = {
  bg: '#06040f',
  text: '#f4f1ff',
  textDim: '#a49cd0',
  cyan: '#3df5ff',
  magenta: '#ff3df2',
  yellow: '#ffe23d',
  orange: '#ff8a1f',
  green: '#3dff8b',
  red: '#ff4d4d',
  panel: 'rgba(10,7,26,0.86)',
  border: '#3a2a80',
} as const;

/** Neon text glow for headings. */
export const glowText = (color: string) => ({
  color,
  textShadowColor: color,
  textShadowRadius: 14,
  textShadowOffset: { width: 0, height: 0 },
});
