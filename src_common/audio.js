import { PitchShifter } from './soundtouch.js';

export class PlaybackInterruptedError extends Error {
    constructor(...args) {
        super(...args);
    }
}

export class AudioPlayback {
    constructor() {
        this.tempo          = 1.
        this.pitch          = 1.
        this.volume         = 1.
        this.cutoff         = 0
        this.audioContext   = null; 
        this.playbackNode   = null;
        this.playbackCancel = null;
        this.gainNode       = null;
    }

    createContext() {
        if (!this.audioContext)  {
            this.audioContext   = new AudioContext(); 
            this.gainNode       = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        }
    }

    isPlaying() {
        return !!this.playbackNode;
    }

    stop(message=undefined) {
        if (this.playbackNode !== null) {
            this.playbackNode.disconnect();
            this.playbackNode = null;
            this.playbackCancel(new PlaybackInterruptedError(message));
        }
    }

    play(audioData) {
        this.stop();
        this.createContext();

        const end = Math.min(parseInt(-1 * this.cutoff * 4200), -1)
        const audioDataShort = audioData.slice(0, end);
        return new Promise((resolve, reject) => {
            this.playbackCancel = reject;
            this.audioContext.decodeAudioData(audioDataShort.buffer).then((audioBuffer) => {
                this.playbackNode = new PitchShifter(this.audioContext, audioBuffer, 1024, () => {
                    if (this.playbackNode) {
                        this.playbackNode.disconnect();
                        this.playbackNode = null;
                    }
                    resolve();
                });
                this.gainNode.gain.value = this.volume;
                this.playbackNode.tempo = this.tempo;
                this.playbackNode.pitch = this.pitch;
                this.playbackNode.connect(this.volume > 0.95 ? 
                    this.audioContext.destination : this.gainNode);
            }).catch(error => {
                reject();
            });
        })
    }
}