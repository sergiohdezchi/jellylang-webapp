import { memo, type MouseEvent } from "react";
import type { PhraseEntry, VocabEntry } from "../../api/types";
import type { PreparedSegment } from "./types";
import styles from "./Reader.module.scss";

interface Props {
    prepared: PreparedSegment;
    entries: Map<string, VocabEntry>;
    phraseMarks?: Map<number, PhraseEntry>;
    selectedTerm: string | null;
    onWordClick: (term: string, display: string, prepared: PreparedSegment, phrase?: PhraseEntry) => void;
}

export function wordClass(entry: VocabEntry | undefined): string {
    if (!entry) return styles.new;
    if (entry.status === "learning") return styles[`l${entry.level}`] ?? styles.l1;
    return "";
}

function SegmentText({ prepared, entries, phraseMarks, selectedTerm, onWordClick }: Props) {
    const handleClick = (event: MouseEvent<HTMLSpanElement>, term: string, display: string, phrase?: PhraseEntry) => {
        // Si el usuario está seleccionando varias palabras, el clic lo gestiona la selección de frase
        const selection = window.getSelection()?.toString().trim() ?? "";
        if (/\s/.test(selection)) return;
        event.stopPropagation();
        onWordClick(term, display, prepared, phrase);
    };

    return (
        <>
            {prepared.tokens.map((token, i) => {
                if (token.kind === "text") return <span key={i}>{token.text}</span>;

                const phrase = phraseMarks?.get(token.index);
                const classes = [styles.word, wordClass(entries.get(token.term))];
                if (phrase) classes.push(styles.inPhrase, styles[`p${phrase.level}`] ?? "");
                if (selectedTerm === token.term) classes.push(styles.selected);

                return (
                    <span
                        key={i}
                        className={classes.join(" ")}
                        title={phrase?.meaning ? `${phrase.term}: ${phrase.meaning}` : undefined}
                        onClick={(e) => handleClick(e, token.term, token.text, phrase)}
                    >
                        {token.text}
                    </span>
                );
            })}
        </>
    );
}

export default memo(SegmentText);
