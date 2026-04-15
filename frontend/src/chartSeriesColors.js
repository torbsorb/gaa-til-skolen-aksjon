/**
 * Distinct line colors for Chart.js series (matplotlib Tableau/tab10–style).
 * Indexed by position in the legend (0 = top of standings), not DB id, so
 * neighboring lines stay visually separable.
 */
const BORDER = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
];

function hexToRgba(hex, alpha) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getChartSeriesStyle(index) {
  const borderColor = BORDER[index % BORDER.length];
  return {
    borderColor,
    backgroundColor: hexToRgba(borderColor, 0.25),
  };
}
