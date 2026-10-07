export const DEFAULT_SPLIT_RATIO = 0.5;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

export function clampSplitRatio(ratio: number): number {
    if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
    return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export function ratioToPercent(ratio: number): string {
    return `${Math.round(clampSplitRatio(ratio) * 100)}%`;
}

export function computeNextRatio(startRatio: number, deltaPx: number, containerPx: number): number {
    if (!Number.isFinite(startRatio) || !Number.isFinite(deltaPx) || !Number.isFinite(containerPx) || containerPx <= 0) {
        return clampSplitRatio(startRatio);
    }
    return clampSplitRatio(startRatio + deltaPx / containerPx);
}
