import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { LessonDetail, Lingq, PhraseEntry, VocabEntry, WordStatus } from "../api/types";

interface EntryResponse {
    entry: VocabEntry;
}

export interface CreateLingqInput {
    term: string;
    meaning?: string;
    notes?: string;
    context?: string;
    segment_id?: number;
    video_time?: number | null;
}

/** Estado de las palabras de la lección y acciones para cambiarlo. */
export function useVocabulary(lesson: LessonDetail) {
    const queryClient = useQueryClient();
    const languageId = lesson.language_id;
    const [entries, setEntries] = useState(() => new Map(Object.entries(lesson.vocabulary)));
    const [phrases, setPhrases] = useState<PhraseEntry[]>(lesson.phrases);

    useEffect(() => {
        setEntries(new Map(Object.entries(lesson.vocabulary)));
        setPhrases(lesson.phrases);
    }, [lesson.id]);

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        queryClient.invalidateQueries({ queryKey: ["lingqs"] });
        queryClient.invalidateQueries({ queryKey: ["reviews"] });
    }, [queryClient]);

    const apply = useCallback((entry: VocabEntry) => {
        if (entry.term.includes(" ")) {
            setPhrases((list) => {
                const rest = list.filter((p) => p.term !== entry.term);
                return entry.status === "new" || !entry.lingq_id ? rest : [...rest, entry as PhraseEntry];
            });
            return;
        }
        setEntries((map) => {
            const next = new Map(map);
            if (entry.status === "new") next.delete(entry.term);
            else next.set(entry.term, entry);
            return next;
        });
    }, []);

    const get = useCallback(
        (term: string): VocabEntry =>
            entries.get(term) ??
            phrases.find((p) => p.term === term) ?? { term, status: "new", level: 0, lingq_id: null, meaning: null },
        [entries, phrases],
    );

    const createLingq = useCallback(
        async (input: CreateLingqInput) => {
            const data = await api<EntryResponse & { lingq: Lingq }>("/lingqs", {
                method: "POST",
                body: { ...input, language_id: languageId, lesson_id: lesson.id },
            });
            apply(data.entry);
            invalidate();
            return data.entry;
        },
        [apply, invalidate, languageId, lesson.id],
    );

    const setStatus = useCallback(
        async (term: string, status: WordStatus, level?: number) => {
            const data = await api<EntryResponse>("/user_words", {
                method: "PUT",
                body: { term, status, level, language_id: languageId },
            });
            apply(data.entry);
            invalidate();
            return data.entry;
        },
        [apply, invalidate, languageId],
    );

    const updateLingq = useCallback(
        async (id: number, changes: { meaning?: string; notes?: string; level?: number }) => {
            const data = await api<EntryResponse>(`/lingqs/${id}`, { method: "PATCH", body: changes });
            apply(data.entry);
            invalidate();
            return data.entry;
        },
        [apply, invalidate],
    );

    const deleteLingq = useCallback(
        async (id: number) => {
            const data = await api<EntryResponse>(`/lingqs/${id}`, { method: "DELETE" });
            apply(data.entry);
            invalidate();
        },
        [apply, invalidate],
    );

    /** Marca como conocidas las palabras que siguen siendo nuevas. */
    const markKnown = useCallback(
        async (terms: string[]) => {
            const pending = [...new Set(terms)].filter((term) => !entries.has(term));
            if (pending.length === 0) return;

            const data = await api<{ terms: string[] }>("/user_words/bulk", {
                method: "POST",
                body: { language_id: languageId, terms: pending },
            });
            setEntries((map) => {
                const next = new Map(map);
                data.terms.forEach((term) => next.set(term, { term, status: "known", level: 1, lingq_id: null, meaning: null }));
                return next;
            });
            invalidate();
        },
        [entries, invalidate, languageId],
    );

    return useMemo(
        () => ({ entries, phrases, get, createLingq, setStatus, updateLingq, deleteLingq, markKnown }),
        [entries, phrases, get, createLingq, setStatus, updateLingq, deleteLingq, markKnown],
    );
}

export type Vocabulary = ReturnType<typeof useVocabulary>;
