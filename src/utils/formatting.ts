/**
 * Formatting utilities for metrics display
 */

/**
 * Format bytes to human-readable format (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes == null) return '0 B';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format percentage value with proper rounding
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value == null) return '0%';
  return Math.min(100, Math.max(0, parseFloat(value.toFixed(decimals)))) + '%';
}

/**
 * Determine color based on percentage threshold
 * Green: 0-70%, Amber: 70-85%, Red: 85-100%
 */
export function getColorByPercentage(percentage: number): 'green' | 'amber' | 'red' {
  if (percentage < 70) return 'green';
  if (percentage < 85) return 'amber';
  return 'red';
}

/**
 * Get CSS color variable for a given color zone
 */
export function getCssColorForZone(zone: 'green' | 'amber' | 'red'): string {
  const colorMap = {
    green: 'var(--green)',
    amber: 'var(--yellow)',
    red: 'var(--red)',
  };
  return colorMap[zone];
}
