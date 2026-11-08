import type { PhraseEntry, Segment } from "../../api/types";
import type { Token } from "../../lib/tokenize";

export interface PreparedSegment {
    segment: Segment;
    tokens: Token[];
    terms: string[];
}

export interface WordSelection {
    term: string;
    display: string;
    isPhrase: boolean;
    segment: Segment;
    /** Frase guardada a la que pertenece la palabra pulsada, si la hay */
    phrase?: PhraseEntry;
}
