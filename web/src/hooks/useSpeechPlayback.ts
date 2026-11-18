import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Playback } from "../components/Reader/playback";
import type { PreparedSegment } from "../components/Reader/types";
import { wordAtChar } from "../lib/wordTiming";
import { useStoredState } from "./useStoredState";

const synth: SpeechSynthesis | null = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

function matchesLanguage(voice: SpeechSynthesisVoice, code: string) {
    return voice.lang.toLowerCase().replace("_", "-").split("-")[0] === code.toLowerCase();
}

/**
 * Lee la lección con la síntesis de voz del navegador, frase a frase.
 * La palabra activa se obtiene de los eventos `boundary`. Si la voz no los emite
 * (p. ej. las voces en red de Chrome) solo se resalta la frase: estimar por tiempo marcaba
 * palabras equivocadas.
 */
export function useSpeechPlayback(prepared: PreparedSegment[], languageCode: string) {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [voiceName, setVoiceName] = useStoredState(`jellylang.voice.${languageCode}`, "");
    const [rate, setRate] = useStoredState("jellylang.ttsRate", 1);
    const [playing, setPlaying] = useState(false);
    const [loop, setLoop] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [activeWord, setActiveWord] = useState(-1);

    useEffect(() => {
        if (!synth) return;
        const load = () => setVoices(synth.getVoices().filter((v) => matchesLanguage(v, languageCode)));
        load();
        synth.addEventListener("voiceschanged", load);
        return () => synth.removeEventListener("voiceschanged", load);
    }, [languageCode]);

    const voice = voices.find((v) => v.name === voiceName) ?? voices.find((v) => v.default) ?? voices[0] ?? null;

    // Rango de caracteres de cada palabra, por segmento
    const ranges = useMemo(
        () =>
            prepared.map(({ tokens }) => {
                const list: { start: number; end: number }[] = [];
                let offset = 0;
                for (const token of tokens) {
                    if (token.kind === "word") list.push({ start: offset, end: offset + token.text.length });
                    offset += token.text.length;
                }
                return list;
            }),
        [prepared],
    );

    // Estado mutable compartido por los callbacks de las utterances
    const state = useRef({ run: 0, index: 0, playing: false, loop, rate, voice });
    state.current.loop = loop;
    state.current.rate = rate;
    state.current.voice = voice;

    const speakFrom = useCallback(
        (index: number) => {
            if (!synth) return;
            const s = state.current;
            const run = ++s.run;
            synth.cancel();

            if (index < 0 || index >= prepared.length) {
                s.playing = false;
                setPlaying(false);
                setActiveWord(-1);
                return;
            }

            s.index = index;
            setActiveIndex(index);
            setActiveWord(-1);

            const text = prepared[index].segment.text;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = s.voice?.lang ?? languageCode;
            if (s.voice) utterance.voice = s.voice;
            utterance.rate = s.rate;

            utterance.onboundary = (event) => {
                if (run !== s.run || event.name === "sentence") return;
                setActiveWord(wordAtChar(ranges[index], event.charIndex));
            };
            utterance.onend = () => {
                if (run !== s.run) return;
                if (s.playing) speakFrom(s.loop ? index : index + 1);
            };
            utterance.onerror = () => {
                // Nuestras cancelaciones cambian `run`; si coincide, la interrumpió otra cosa
                if (run !== s.run) return;
                s.playing = false;
                setPlaying(false);
                setActiveWord(-1);
            };

            // Chrome a veces ignora speak() justo después de cancel()
            window.setTimeout(() => {
                if (run === s.run) synth.speak(utterance);
            }, 50);
        },
        [prepared, ranges, languageCode],
    );

    const pause = useCallback(() => {
        const s = state.current;
        s.playing = false;
        s.run++;
        synth?.cancel();
        setPlaying(false);
        setActiveWord(-1);
    }, []);

    const playSegment = useCallback(
        (index: number) => {
            state.current.playing = true;
            setPlaying(true);
            speakFrom(index);
        },
        [speakFrom],
    );

    // Cambiar voz o velocidad reinicia la frase actual
    useEffect(() => {
        if (state.current.playing) speakFrom(state.current.index);
    }, [rate, voice?.name]);

    useEffect(() => () => pause(), [pause]);

    const playback: Playback = {
        kind: "speech",
        available: Boolean(synth) && voices.length > 0,
        playing,
        activeIndex,
        activeWord,
        rate,
        setRate,
        loop,
        setLoop,
        play: () => playSegment(state.current.index),
        pause,
        toggle: () => (state.current.playing ? pause() : playSegment(state.current.index)),
        playSegment,
        setPosition: (index) => {
            if (state.current.playing) playSegment(index);
            else state.current.index = index;
        },
    };

    return { playback, voices, voice, setVoiceName, supported: Boolean(synth) };
}
