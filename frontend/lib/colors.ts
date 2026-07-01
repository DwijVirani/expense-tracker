/** Stable 8-color vivid palette for categorical chart data. */
export const CHART_PALETTE: readonly string[] = [
  "#14B8A6", // teal
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#3B82F6", // blue
  "#22C55E", // green
  "#FB923C", // orange
  "#06B6D4", // cyan
];

/**
 * Maps a category name to a stable chart color via hash.
 * Same name always returns the same color regardless of data ordering.
 */
export function categoryColor(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i);
  }
  return CHART_PALETTE[Math.abs(hash) % CHART_PALETTE.length];
}
