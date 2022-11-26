
import {AudioPlayback, PlaybackInterruptedError} from "../src_common/audio.js";
import {GoogleTranslateTTS} from "../src_common/google_tts.js"
import {PageReaderPdf, TextSelectionHighlighter} from "../src_common/reader.js";


class Condition {
    constructor() {
        this.#createPromise();
    }

    #createPromise() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject  = reject;
        });
    }

    set(...args) {
        const resolve = this.resolve;
        this.#createPromise();
        resolve(...args);
    }

    cancel(...args) {
        const reject = this.reject;
        this.#createPromise();
        reject(...args);
    }

    wait() {
        return this.promise;
    }

}

export class TTSReader {
    constructor(pageReader, textHighlighter, audioPlayback, ttsEngine) {
        this.pageReader      = pageReader;
        this.textHighlighter = textHighlighter;
        this.audioPlayback   = audioPlayback;
        this.ttsEngine       = ttsEngine;

        this.maxHistory     = 5;
        this.maxPrefetch    = 2;
        this.filterWords    = true;
        this.filterURLs     = true;
        this.filterCites    = true;

        this.isSpeaking     = false;
        this.signalPlayback = new Condition();
        this.signalLoader   = new Condition();

        this.#workerTTS();
        this.#workerPlayback();
    }

    #cleanSentence(text) {
        if (this.filterCites)
            text = text.replace(/ ?(\[[0-9\, -]+\])|(\([^)(]*((et al.)|([0-9]{4}))[^)(]*\))/g, '');
        if (this.filterURLs)
            text = text.replace(/ ?https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g, '');
        if (this.filterWords && [...text.matchAll(/[^\s]*[a-zA-Z\.\,\:-\’\`]{3,}[^\s]*/g)].length < 3)
            return false;
        return text;
    }

    async #workerTTS() {
        while (true) {
            await this.signalLoader.wait();
            try {
                while (this.history.length - this.index <= this.maxPrefetch) {
                    const {value, done} = this.iter.next();
                    if (done) continue;
                    const {sentence, elems, start, end} = value;
                    const clean = this.#cleanSentence(sentence);
                    if (!clean) continue;
                    const audio = await this.ttsEngine.fetchAudio(clean);
                    this.history.push({audio, sentence, elems, start, end});
                    if (this.index - this.maxHistory >= 0)
                        this.history[this.index - this.maxHistory] = null;
                    this.signalPlayback.set();
                }
            } catch (error) {
                console.warn("error while fetching audio", error);
            }
        }
    }

    async #workerPlayback() {
        while (true) {
            await this.signalPlayback.wait();
            try {
                this.isSpeaking = true;
                this.onPlaybackStart();
                while (this.index < this.history.length && this.history[this.index]) {
                        const {audio, sentence, elems, start, end} = this.history[this.index];
                        this.textHighlighter.highlight(elems, start, end);
                        try {
                            await this.audioPlayback.play(audio);
                        } catch (error) {
                            if (error instanceof PlaybackInterruptedError) {
                                if (error.message == "skip") {
                                    continue;
                                } else {
                                    break;
                                }
                            } else {
                                console.warn("error while playing back audio", error);
                            }
                        } finally {
                            this.textHighlighter.unhighlight(elems);
                        }
                        this.index++;
                        this.signalLoader.set();
                    }
                this.isSpeaking = false;
                this.onPlaybackEnd();
            } catch (error) {
                console.warn("error while playing back audio 2", error);
            }
        }
    }

    onPlaybackStart() { }

    onPlaybackEnd() { }

    speak() {
        this.iter    = this.pageReader.iterSentences();
        this.history = [];
        this.index   = 0;
        this.signalLoader.set();
        if (this.isSpeaking) 
            this.audioPlayback.stop();
    }

    stop() {
        this.audioPlayback.stop();
    }

    skip(offset) {
        const index = this.index + offset;
        if (this.isSpeaking && index >= 0 && index < this.history.length) {
            this.index = index;
            this.signalLoader.set();
            this.audioPlayback.stop("skip");
        }
    }
}


export class TTSReaderOld {
    constructor(ttsEngine, audioPlayback) {
        this.skipCommas    = false;
        this.skipURLs      = true;
        this.skipCitations = true;
        this.ttsEngine     = ttsEngine;
        this.audioPlayback = audioPlayback;
    }

    isSpeaking() {
        return this.audioPlayback.isPlaying();
    }

    stop() {
        this.audioPlayback.stop();
    }

    *splitText(text) {
        let begin = 0;
        for (const match of text.matchAll(/[\?|\;|\:|\!|\.] ?[a-zA-Z]/gm)) {
            const end = match.index + match[0].length-1
            yield [begin, end];
            begin = end;
        }
        yield [begin, text.length-1];
    }

    async speakText(text, onSentenceBegin=(slice) => {}) {
        const slices = [...this.splitText(text)];
        const sentences = slices.map(([l, r]) => text.slice(l, r));
        await this.speakSentences(sentences, i => onSentenceBegin(slices[i]));
    }

    async speakSentences(sentences, onSentenceBegin=(i) => {}) {
        if (sentences.length == 0) return;
        let audioData = await this.ttsEngine.fetchAudio(sentences[0]);
        let _ = undefined;
        for (let i = 0; i < sentences.length-1; i++) {
            onSentenceBegin(i);
            [_, audioData] = await Promise.all([this.audioPlayback.play(audioData), this.ttsEngine.fetchAudio(sentences[i+1])]);
        }
        onSentenceBegin(sentences.length-1);
        await this.audioPlayback.play(audioData)
    }


}

