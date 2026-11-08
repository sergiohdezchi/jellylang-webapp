import { useMemo } from "react";
import type { PhraseEntry } from "../../api/types";
import { markPhrases } from "../../lib/tokenize";
import type { PreparedSegment } from "./types";

/** Para cada segmento, índice de palabra -> frase guardada que la contiene. */
export function usePhraseMarks(prepared: PreparedSegment[], phrases: PhraseEntry[]) {
    return useMemo(() => {
        const result = new Map<number, Map<number, PhraseEntry>>();
        if (phrases.length === 0) return result;

        for (const item of prepared) {
            const marks = markPhrases(item.terms, phrases);
            if (marks.size > 0) result.set(item.segment.id, marks);
        }
        return result;
    }, [prepared, phrases]);
}
