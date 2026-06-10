export const DEFAULT_LINE_HEIGHT = 28;
export const DEFAULT_OVERSCAN = 8;
export const VIRTUALIZE_LINE_THRESHOLD = 300;

export interface VirtualWindowOptions {
  totalLines: number;
  scrollTop: number;
  containerHeight: number;
  lineHeight?: number;
  overscan?: number;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export function shouldVirtualizeLines(
  totalLines: number,
  threshold = VIRTUALIZE_LINE_THRESHOLD
): boolean {
  return totalLines > threshold;
}

export function getVirtualWindow({
  totalLines,
  scrollTop,
  containerHeight,
  lineHeight = DEFAULT_LINE_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
}: VirtualWindowOptions): VirtualWindow {
  if (totalLines <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    };
  }

  const safeHeight = Math.max(containerHeight, lineHeight);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / lineHeight) - overscan
  );
  const visibleCount = Math.ceil(safeHeight / lineHeight) + overscan * 2;
  const endIndex = Math.min(totalLines, startIndex + visibleCount);

  return {
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * lineHeight,
    bottomSpacerHeight: Math.max(0, (totalLines - endIndex) * lineHeight),
  };
}
