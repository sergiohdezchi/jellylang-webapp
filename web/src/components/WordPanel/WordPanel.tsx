import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Language, Translation, VocabEntry, WordStatus } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import type { Vocabulary } from "../../hooks/useVocabulary";
import { tokenize } from "../../lib/tokenize";
import type { WordSelection } from "../Reader/types";
import Icon from "../Icon";
import { dictionaryLinks } from "./dictionaries";
import styles from "./WordPanel.module.scss";

interface Props {
    selection: WordSelection;
    vocabulary: Vocabulary;
    language: Language;
    nativeLanguage: string;
    onClose: () => void;
    onOpenPhrase: (selection: WordSelection) => void;
    /** Reproduce (video o voz) la frase donde está la palabra */
    onPlaySentence?: () => void;
}

const LEVELS = [1, 2, 3, 4];

export default function WordPanel({ selection, vocabulary, language, nativeLanguage, onClose, onOpenPhrase, onPlaySentence }: Props) {
    const { t } = useI18n();
    const entry: VocabEntry = vocabulary.get(selection.term);
    const [meaning, setMeaning] = useState(entry.meaning ?? "");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const meaningRef = useRef<HTMLTextAreaElement>(null);
    const hasLingq = Boolean(entry.lingq_id);

    useEffect(() => {
        setMeaning(entry.meaning ?? "");
        setNotes("");
        setError(null);
        setSaved(false);
    }, [selection.term]);

    const { data: translation, isFetching } = useQuery({
        queryKey: ["dictionary", language.code, nativeLanguage, selection.term],
        queryFn: () => api<Translation>("/dictionary", { query: { term: selection.display, from: language.code, to: nativeLanguage } }),
        staleTime: Infinity,
        enabled: !entry.meaning,
    });

    const suggestions = translation ? [translation.translation, ...translation.alternatives].filter((s): s is string => Boolean(s)) : [];

    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            setBusy(false);
        }
    }

    function createLingq(level = 1) {
        return run(async () => {
            const created = await vocabulary.createLingq({
                term: selection.term,
                meaning: meaning.trim() || suggestions[0] || "",
                notes: notes.trim() || undefined,
                context: selection.segment.text,
                segment_id: selection.segment.id,
                video_time: selection.segment.start,
            });
            if (level > 1 && created.lingq_id) await vocabulary.updateLingq(created.lingq_id, { level });
        });
    }

    function setLevel(level: number) {
        if (entry.status === "new") return createLingq(level);
        if (hasLingq && entry.status === "learning") return run(() => vocabulary.updateLingq(entry.lingq_id!, { level }));
        return run(() => vocabulary.setStatus(selection.term, "learning", level));
    }

    function setStatus(status: WordStatus) {
        return run(() => vocabulary.setStatus(selection.term, entry.status === status ? "new" : status));
    }

    async function saveMeaning() {
        if (!entry.lingq_id || meaning.trim() === (entry.meaning ?? "")) return;
        await run(() => vocabulary.updateLingq(entry.lingq_id!, { meaning: meaning.trim() }));
        setSaved(true);
    }

    function speak() {
        if (!("speechSynthesis" in window)) return;
        const utterance = new SpeechSynthesisUtterance(selection.display);
        utterance.lang = language.code;
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    // Atajos: 1-4 nivel, K conocida, X ignorar, Esc cerrar
    const actions = useRef({ setLevel, setStatus, onClose });
    actions.current = { setLevel, setStatus, onClose };
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select") || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === "Escape") actions.current.onClose();
            else if (["1", "2", "3", "4"].includes(event.key)) actions.current.setLevel(Number(event.key));
            else if (event.key.toLowerCase() === "k") actions.current.setStatus("known");
            else if (event.key.toLowerCase() === "x") actions.current.setStatus("ignored");
            else return;
            event.preventDefault();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const contextTokens = tokenize(selection.segment.text);
    const phraseTerms = new Set(selection.term.split(" "));

    return (
        <aside className={styles.panel} aria-label={selection.display} data-reading-obstruction="bottom">
            <header className={styles.header}>
                <div>
                    <span className={styles.kind}>
                        {selection.isPhrase ? t("panel.phrase") : entry.status === "new" ? t("panel.new_word") : t("panel.word")}
                    </span>
                    <h2 className={styles.term}>{selection.display}</h2>
                </div>
                <div className={styles.headerActions}>
                    <button className="btn ghost icon" onClick={speak} title={t("panel.listen")} aria-label={t("panel.listen")}>
                        <Icon name="speaker" />
                    </button>
                    <button className="btn ghost icon" onClick={onClose} title={t("panel.close")} aria-label={t("panel.close")}>
                        <Icon name="close" />
                    </button>
                </div>
            </header>

            <div className={styles.body}>
                {error && <div className="alert error">{error}</div>}

                <div className={styles.section}>
                    <span className={styles.label}>{t("panel.status")}</span>
                    <div className={styles.status}>
                        {LEVELS.map((level) => (
                            <button
                                key={level}
                                className={`${styles.levelBtn} ${styles[`l${level}`]} ${entry.status === "learning" && entry.level === level ? styles.current : ""}`}
                                onClick={() => setLevel(level)}
                                disabled={busy}
                                title={`${level}`}
                            >
                                {level}
                            </button>
                        ))}
                        <button
                            className={`${styles.levelBtn} ${styles.known} ${entry.status === "known" ? styles.current : ""}`}
                            onClick={() => setStatus("known")}
                            disabled={busy}
                            title={`${t("panel.known")} (K)`}
                        >
                            <Icon name="check" size={16} />
                        </button>
                        <button
                            className={`${styles.levelBtn} ${styles.ignored} ${entry.status === "ignored" ? styles.current : ""}`}
                            onClick={() => setStatus("ignored")}
                            disabled={busy}
                            title={`${t("panel.ignore")} (X)`}
                        >
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                </div>

                <label className={styles.section}>
                    <span className={styles.label}>
                        {t("panel.meaning")} {saved && <span className={styles.saved}>· {t("panel.saved")}</span>}
                    </span>
                    <textarea
                        ref={meaningRef}
                        className="textarea"
                        rows={2}
                        placeholder={t("panel.meaning_placeholder")}
                        value={meaning}
                        onChange={(e) => {
                            setMeaning(e.target.value);
                            setSaved(false);
                        }}
                        onBlur={saveMeaning}
                    />
                </label>

                {!entry.meaning && (
                    <div className={styles.section}>
                        <span className={styles.label}>{t("panel.suggestions")}</span>
                        {isFetching ? (
                            <div className="spinner" />
                        ) : suggestions.length > 0 ? (
                            <div className={styles.chips}>
                                {suggestions.map((s) => (
                                    <button
                                        key={s}
                                        className={`${styles.chip} ${meaning === s ? styles.chipActive : ""}`}
                                        onClick={() => {
                                            setMeaning(s);
                                            meaningRef.current?.focus();
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="muted">{t("panel.no_suggestions")}</p>
                        )}
                    </div>
                )}

                {!hasLingq && (
                    <>
                        <label className={styles.section}>
                            <span className={styles.label}>{t("panel.notes")}</span>
                            <textarea className="textarea" rows={2} placeholder={t("panel.notes_placeholder")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </label>
                        <button className="btn primary" style={{ width: "100%" }} onClick={() => createLingq()} disabled={busy}>
                            <Icon name="plus" /> {t("panel.create")}
                        </button>
                    </>
                )}

                {selection.phrase && (
                    <button
                        className={styles.phraseLink}
                        onClick={() =>
                            onOpenPhrase({ term: selection.phrase!.term, display: selection.phrase!.term, isPhrase: true, segment: selection.segment })
                        }
                    >
                        <strong>{selection.phrase.term}</strong>
                        {selection.phrase.meaning && <span className="muted"> — {selection.phrase.meaning}</span>}
                    </button>
                )}

                <div className={styles.section}>
                    <span className={styles.label}>
                        {t("panel.context")}
                        {onPlaySentence && (
                            <button className={styles.playSentence} onClick={onPlaySentence}>
                                <Icon name="play" size={11} /> {t("panel.play_sentence")}
                            </button>
                        )}
                    </span>
                    <p className={styles.context}>
                        {contextTokens.map((token, i) =>
                            token.kind === "word" && (selection.isPhrase ? phraseTerms.has(token.term) : token.term === selection.term) ? (
                                <mark key={i}>{token.text}</mark>
                            ) : (
                                <span key={i}>{token.text}</span>
                            ),
                        )}
                    </p>
                </div>

                <div className={styles.section}>
                    <span className={styles.label}>{t("panel.dictionaries")}</span>
                    <div className={styles.links}>
                        {dictionaryLinks(selection.display, language.code, nativeLanguage).map((link) => (
                            <a key={link.name} href={link.url} target="_blank" rel="noreferrer">
                                {link.name} <Icon name="external" size={12} />
                            </a>
                        ))}
                    </div>
                </div>

                {hasLingq && (
                    <button className="btn ghost danger small" onClick={() => run(() => vocabulary.deleteLingq(entry.lingq_id!))} disabled={busy}>
                        <Icon name="trash" size={14} /> {t("panel.delete_lingq")}
                    </button>
                )}

                <p className={styles.shortcuts}>
                    <kbd>1</kbd>–<kbd>4</kbd> · <kbd>K</kbd> {t("panel.known")} · <kbd>X</kbd> {t("panel.ignore")} · <kbd>Esc</kbd>
                </p>
            </div>
        </aside>
    );
}
