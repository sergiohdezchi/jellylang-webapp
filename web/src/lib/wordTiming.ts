/**
 * Inicio de cada palabra de un segmento, solo si los tiempos son reales y coherentes:
 * uno por palabra, crecientes y dentro del segmento. En cualquier otro caso devuelve null.
 *
 * Nunca se estiman: una palabra marcada fuera de lugar es peor que no marcar ninguna,
 * así que sin tiempos exactos solo se resalta la frase.
 */
export function exactWordTimes(
    segment: { start: number | null; end: number | null; word_times: (number | null)[] | null },
    wordCount: number,
): number[] | null {
    const times = segment.word_times;
    if (!times || wordCount === 0 || times.length !== wordCount) return null;

    const start = segment.start ?? 0;
    const end = segment.end ?? start;
    let previous = start - 0.5;

    for (const time of times) {
        if (time === null || time < previous || time > end + 0.5) return null;
        previous = time;
    }
    return times as number[];
}

/** Índice de la última palabra que ya empezó; -1 si aún no empezó ninguna. */
export function wordAtTime(times: number[], time: number): number {
    let low = 0;
    let high = times.length - 1;
    let result = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (times[mid] <= time) {
            result = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return result;
}

/** Índice de la palabra que contiene (o sigue a) la posición `charIndex` del texto. */
export function wordAtChar(ranges: { start: number; end: number }[], charIndex: number): number {
    let result = -1;
    for (let i = 0; i < ranges.length; i++) {
        if (ranges[i].start <= charIndex) result = i;
        else break;
    }
    return result;
}
