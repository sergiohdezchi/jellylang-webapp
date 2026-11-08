import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { LessonDetail } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import type { Vocabulary } from "../../hooks/useVocabulary";
import { paginate } from "../../lib/segments";
import Icon from "../Icon";
import SegmentText from "./SegmentText";
import type { PreparedSegment } from "./types";
import { usePhraseMarks } from "./usePhraseMarks";
import styles from "./TextReader.module.scss";

interface Props {
    lesson: LessonDetail;
    prepared: PreparedSegment[];
    vocabulary: Vocabulary;
    selectedTerm: string | null;
    onWordClick: (term: string, display: string, prepared: PreparedSegment) => void;
}

export default function TextReader({ lesson, prepared, vocabulary, selectedTerm, onWordClick }: Props) {
    const { t } = useI18n();
    const queryClient = useQueryClient();

    const pages = useMemo(() => {
        const paragraphs: PreparedSegment[][] = [];
        prepared.forEach((item) => {
            const last = paragraphs[paragraphs.length - 1];
            if (last && last[0].segment.paragraph === item.segment.paragraph) last.push(item);
            else paragraphs.push([item]);
        });
        return paginate(paragraphs, (p) => p.reduce((sum, item) => sum + item.terms.length, 0));
    }, [prepared]);

    const [page, setPage] = useState(() => Math.min(lesson.progress_page, Math.max(pages.length - 1, 0)));
    const [completed, setCompleted] = useState(false);
    const [busy, setBusy] = useState(false);
    const phraseMarks = usePhraseMarks(prepared, vocabulary.phrases);

    const current = pages[page] ?? [];
    const pageTerms = current.flat().flatMap((item) => item.terms);
    const isLast = page >= pages.length - 1;

    async function advance(target: number) {
        setBusy(true);
        try {
            // Como en LingQ: al pasar página, las palabras azules se consideran conocidas
            await vocabulary.markKnown(pageTerms);
            await api("/stats/activity", { method: "POST", body: { language_id: lesson.language_id, words_read: pageTerms.length } });
            const completing = target >= pages.length;
            await api(`/lessons/${lesson.id}`, {
                method: "PATCH",
                body: completing ? { completed: true } : { progress_page: target },
            });
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
            if (completing) setCompleted(true);
            else setPage(target);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            setBusy(false);
        }
    }

    function goBack() {
        setPage((p) => Math.max(0, p - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (completed) {
        return (
            <div className={`card ${styles.done}`}>
                <Icon name="check" size={40} />
                <h2>{t("lesson.completed")}</h2>
                <button
                    className="btn"
                    onClick={() => {
                        setCompleted(false);
                        setPage(0);
                    }}
                >
                    {t("lesson.page", { page: 1, total: pages.length })}
                </button>
            </div>
        );
    }

    return (
        <div>
            <article className={styles.text}>
                {current.map((paragraph) => (
                    <p key={paragraph[0].segment.id}>
                        {paragraph.map((item, i) => (
                            <span key={item.segment.id} data-segment-id={item.segment.id}>
                                {i > 0 && " "}
                                <SegmentText
                                    prepared={item}
                                    entries={vocabulary.entries}
                                    phraseMarks={phraseMarks.get(item.segment.id)}
                                    selectedTerm={selectedTerm}
                                    onWordClick={onWordClick}
                                />
                            </span>
                        ))}
                    </p>
                ))}
            </article>

            <nav className={styles.pager}>
                <button className="btn" onClick={goBack} disabled={page === 0 || busy}>
                    <Icon name="arrowLeft" /> {t("common.prev")}
                </button>
                <span className="muted">{t("lesson.page", { page: page + 1, total: pages.length })}</span>
                <button
                    className="btn primary"
                    onClick={() => advance(page + 1)}
                    disabled={busy}
                    title={isLast ? t("lesson.complete_hint") : t("lesson.next_hint")}
                >
                    {isLast ? t("lesson.complete") : t("common.next")} {isLast ? <Icon name="check" /> : <Icon name="next" />}
                </button>
            </nav>
            <p className={styles.hint}>{isLast ? t("lesson.complete_hint") : t("lesson.next_hint")}</p>
        </div>
    );
}
