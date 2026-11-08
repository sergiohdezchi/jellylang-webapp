export interface TimedSegment {
    start: number | null;
    end: number | null;
}

/** Búsqueda binaria del segmento que contiene `time`; -1 si cae en un hueco. */
export function findActiveSegment(segments: TimedSegment[], time: number): number {
    let low = 0;
    let high = segments.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const segment = segments[mid];
        const start = segment.start ?? 0;
        const end = segment.end ?? start;

        if (time < start) {
            high = mid - 1;
        } else if (time >= end) {
            low = mid + 1;
        } else {
            return mid;
        }
    }

    return -1;
}

/** Último segmento que ya empezó (para mantener el resaltado en los silencios). */
export function findLastStarted(segments: TimedSegment[], time: number): number {
    let low = 0;
    let high = segments.length - 1;
    let result = -1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if ((segments[mid].start ?? 0) <= time) {
            result = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return result;
}

/** Agrupa elementos en páginas de aproximadamente `wordsPerPage` palabras sin partir grupos. */
export function paginate<T>(groups: T[], countWords: (group: T) => number, wordsPerPage = 220): T[][] {
    const pages: T[][] = [];
    let current: T[] = [];
    let count = 0;

    for (const group of groups) {
        const words = countWords(group);
        if (current.length > 0 && count + words > wordsPerPage) {
            pages.push(current);
            current = [];
            count = 0;
        }
        current.push(group);
        count += words;
    }

    if (current.length > 0) pages.push(current);
    return pages;
}
