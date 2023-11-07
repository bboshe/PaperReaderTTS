'use strict';

class TTSController {
    constructor(ttsReader) {
        this.ttsReader = ttsReader;
        this.loadSettings();
        this.registerCallbacks();
    }

    registerCallbacks() {
        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.storage.local.onChanged.addListener(this.onLocalStorageChange.bind(this));
        if (document.readyState !== "loading") {
            this.onDOMLoaded();
        } else {
            document.addEventListener('DOMContentLoaded', this.onDOMLoaded.bind(this), false);
        }
    }

    onMessage(message, sender, sendResponse) {
        if (!("method" in message)) return;
        if (message.method === "command") 
            this.onKeyboardCommand(message.args[0], message.args[1]);
        if (message.method === "context-menu-clicked") 
            this.onContextMenuClicked(message.args[0], message.args[1]);
    }

    onLocalStorageChange(changes, areaName) {
        this.loadSettings();
    }

    onKeyboardCommand(command, tab) {
        if      (command === "play") { this.ttsReader.isSpeaking ? this.ttsReader.stop() : this.ttsReader.speak(); } 
        else if (command === "next") { this.ttsReader.skip(1); } 
        else if (command === "prev") { this.ttsReader.skip(-1); }
    }

    onContextMenuClicked(info, tab) {
        if (info.menuItemId === "item-speak") { 
            if (!this.ttsReader.isSpeaking) { this.ttsReader.speak(); } else { this.ttsReader.stop(); }
        }
    }

    onDOMLoaded() {
        document.addEventListener('selectionchange', () => {
            const selection = document.getSelection();
            if (!selection.toString()) {
                this.ttsReader.stop();
            }
        });
    }

    loadSettings() {
        chrome.storage.local.get({
            "tts-language"  : "en",
            "audio-tempo"   : 1.,
            "audio-pitch"   : 0.,
            "audio-volume"  : 1.,
            "audio-delay"   : 0.,
            "tts-skip-words": false,
            "tts-skip-comma": true,
            "tts-skip-url"  : true,
            "tts-skip-cite" : true,
        }).then(settings => {
            this.ttsReader.ttsEngine.language   = settings["tts-language"];
            this.ttsReader.audioPlayback.tempo  = settings["audio-tempo" ];
            this.ttsReader.audioPlayback.pitch  = 1 + settings["audio-pitch" ];
            this.ttsReader.audioPlayback.volume = settings["audio-volume"];
            this.ttsReader.audioPlayback.cutoff = Math.max(0, -settings["audio-delay"]);
            this.ttsReader.filterWords          = settings["tts-skip-words"];
    //        this.ttsReader.filterCommas         = !settings["tts-skip-comma"];
            this.ttsReader.filterURLs           = settings["tts-skip-url"  ];
            this.ttsReader.filterCites          = settings["tts-skip-cite" ];
        });
    }
}


//this.ttsReader.onPlaybackStart = () => {
//    chrome.contextMenus.update("item-speak", {title: "Stop Speaking"});
//};
//
//this.ttsReader.onPlaybackEnd = () => {
//    chrome.contextMenus.update("item-speak", {title: "Read Aloud"});
//};

/*
 * SoundTouch JS v0.1.30 audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

class FifoSampleBuffer {
  constructor() {
    this._vector = new Float32Array();
    this._position = 0;
    this._frameCount = 0;
  }
  get vector() {
    return this._vector;
  }
  get position() {
    return this._position;
  }
  get startIndex() {
    return this._position * 2;
  }
  get frameCount() {
    return this._frameCount;
  }
  get endIndex() {
    return (this._position + this._frameCount) * 2;
  }
  clear() {
    this.receive(this._frameCount);
    this.rewind();
  }
  put(numFrames) {
    this._frameCount += numFrames;
  }
  putSamples(samples, position, numFrames = 0) {
    position = position || 0;
    const sourceOffset = position * 2;
    if (!(numFrames >= 0)) {
      numFrames = (samples.length - sourceOffset) / 2;
    }
    const numSamples = numFrames * 2;
    this.ensureCapacity(numFrames + this._frameCount);
    const destOffset = this.endIndex;
    this.vector.set(samples.subarray(sourceOffset, sourceOffset + numSamples), destOffset);
    this._frameCount += numFrames;
  }
  putBuffer(buffer, position, numFrames = 0) {
    position = position || 0;
    if (!(numFrames >= 0)) {
      numFrames = buffer.frameCount - position;
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames);
  }
  receive(numFrames) {
    if (!(numFrames >= 0) || numFrames > this._frameCount) {
      numFrames = this.frameCount;
    }
    this._frameCount -= numFrames;
    this._position += numFrames;
  }
  receiveSamples(output, numFrames = 0) {
    const numSamples = numFrames * 2;
    const sourceOffset = this.startIndex;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    this.receive(numFrames);
  }
  extract(output, position = 0, numFrames = 0) {
    const sourceOffset = this.startIndex + position * 2;
    const numSamples = numFrames * 2;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
  }
  ensureCapacity(numFrames = 0) {
    const minLength = parseInt(numFrames * 2);
    if (this._vector.length < minLength) {
      const newVector = new Float32Array(minLength);
      newVector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._vector = newVector;
      this._position = 0;
    } else {
      this.rewind();
    }
  }
  ensureAdditionalCapacity(numFrames = 0) {
    this.ensureCapacity(this._frameCount + numFrames);
  }
  rewind() {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._position = 0;
    }
  }
}

class AbstractFifoSamplePipe {
  constructor(createBuffers) {
    if (createBuffers) {
      this._inputBuffer = new FifoSampleBuffer();
      this._outputBuffer = new FifoSampleBuffer();
    } else {
      this._inputBuffer = this._outputBuffer = null;
    }
  }
  get inputBuffer() {
    return this._inputBuffer;
  }
  set inputBuffer(inputBuffer) {
    this._inputBuffer = inputBuffer;
  }
  get outputBuffer() {
    return this._outputBuffer;
  }
  set outputBuffer(outputBuffer) {
    this._outputBuffer = outputBuffer;
  }
  clear() {
    this._inputBuffer.clear();
    this._outputBuffer.clear();
  }
}

class RateTransposer extends AbstractFifoSamplePipe {
  constructor(createBuffers) {
    super(createBuffers);
    this.reset();
    this._rate = 1;
  }
  set rate(rate) {
    this._rate = rate;
  }
  reset() {
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
  }
  clone() {
    const result = new RateTransposer();
    result.rate = this._rate;
    return result;
  }
  process() {
    const numFrames = this._inputBuffer.frameCount;
    this._outputBuffer.ensureAdditionalCapacity(numFrames / this._rate + 1);
    const numFramesOutput = this.transpose(numFrames);
    this._inputBuffer.receive();
    this._outputBuffer.put(numFramesOutput);
  }
  transpose(numFrames = 0) {
    if (numFrames === 0) {
      return 0;
    }
    const src = this._inputBuffer.vector;
    const srcOffset = this._inputBuffer.startIndex;
    const dest = this._outputBuffer.vector;
    const destOffset = this._outputBuffer.endIndex;
    let used = 0;
    let i = 0;
    while (this.slopeCount < 1.0) {
      dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * this.prevSampleL + this.slopeCount * src[srcOffset];
      dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * this.prevSampleR + this.slopeCount * src[srcOffset + 1];
      i = i + 1;
      this.slopeCount += this._rate;
    }
    this.slopeCount -= 1.0;
    if (numFrames !== 1) {
      out: while (true) {
        while (this.slopeCount > 1.0) {
          this.slopeCount -= 1.0;
          used = used + 1;
          if (used >= numFrames - 1) {
            break out;
          }
        }
        const srcIndex = srcOffset + 2 * used;
        dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * src[srcIndex] + this.slopeCount * src[srcIndex + 2];
        dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * src[srcIndex + 1] + this.slopeCount * src[srcIndex + 3];
        i = i + 1;
        this.slopeCount += this._rate;
      }
    }
    this.prevSampleL = src[srcOffset + 2 * numFrames - 2];
    this.prevSampleR = src[srcOffset + 2 * numFrames - 1];
    return i;
  }
}

class FilterSupport {
  constructor(pipe) {
    this._pipe = pipe;
  }
  get pipe() {
    return this._pipe;
  }
  get inputBuffer() {
    return this._pipe.inputBuffer;
  }
  get outputBuffer() {
    return this._pipe.outputBuffer;
  }
  fillInputBuffer() {
    throw new Error('fillInputBuffer() not overridden');
  }
  fillOutputBuffer(numFrames = 0) {
    while (this.outputBuffer.frameCount < numFrames) {
      const numInputFrames = 8192 * 2 - this.inputBuffer.frameCount;
      this.fillInputBuffer(numInputFrames);
      if (this.inputBuffer.frameCount < 8192 * 2) {
        break;
      }
      this._pipe.process();
    }
  }
  clear() {
    this._pipe.clear();
  }
}

const noop = function () {
  return;
};

class SimpleFilter extends FilterSupport {
  constructor(sourceSound, pipe, callback = noop) {
    super(pipe);
    this.callback = callback;
    this.sourceSound = sourceSound;
    this.historyBufferSize = 22050;
    this._sourcePosition = 0;
    this.outputBufferPosition = 0;
    this._position = 0;
  }
  get position() {
    return this._position;
  }
  set position(position) {
    if (position > this._position) {
      throw new RangeError('New position may not be greater than current position');
    }
    const newOutputBufferPosition = this.outputBufferPosition - (this._position - position);
    if (newOutputBufferPosition < 0) {
      throw new RangeError('New position falls outside of history buffer');
    }
    this.outputBufferPosition = newOutputBufferPosition;
    this._position = position;
  }
  get sourcePosition() {
    return this._sourcePosition;
  }
  set sourcePosition(sourcePosition) {
    this.clear();
    this._sourcePosition = sourcePosition;
  }
  onEnd() {
    this.callback();
  }
  fillInputBuffer(numFrames = 0) {
    const samples = new Float32Array(numFrames * 2);
    const numFramesExtracted = this.sourceSound.extract(samples, numFrames, this._sourcePosition);
    this._sourcePosition += numFramesExtracted;
    this.inputBuffer.putSamples(samples, 0, numFramesExtracted);
  }
  extract(target, numFrames = 0) {
    this.fillOutputBuffer(this.outputBufferPosition + numFrames);
    const numFramesExtracted = Math.min(numFrames, this.outputBuffer.frameCount - this.outputBufferPosition);
    this.outputBuffer.extract(target, this.outputBufferPosition, numFramesExtracted);
    const currentFrames = this.outputBufferPosition + numFramesExtracted;
    this.outputBufferPosition = Math.min(this.historyBufferSize, currentFrames);
    this.outputBuffer.receive(Math.max(currentFrames - this.historyBufferSize, 0));
    this._position += numFramesExtracted;
    return numFramesExtracted;
  }
  handleSampleData(event) {
    this.extract(event.data, 4096);
  }
  clear() {
    super.clear();
    this.outputBufferPosition = 0;
  }
}

const USE_AUTO_SEQUENCE_LEN = 0;
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;
const USE_AUTO_SEEKWINDOW_LEN = 0;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;
const DEFAULT_OVERLAP_MS = 8;
const _SCAN_OFFSETS = [[124, 186, 248, 310, 372, 434, 496, 558, 620, 682, 744, 806, 868, 930, 992, 1054, 1116, 1178, 1240, 1302, 1364, 1426, 1488, 0], [-100, -75, -50, -25, 25, 50, 75, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [-20, -15, -10, -5, 5, 10, 15, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [-4, -3, -2, -1, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
const AUTOSEQ_TEMPO_LOW = 0.5;
const AUTOSEQ_TEMPO_TOP = 2.0;
const AUTOSEQ_AT_MIN = 125.0;
const AUTOSEQ_AT_MAX = 50.0;
const AUTOSEQ_K = (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;
const AUTOSEEK_AT_MIN = 25.0;
const AUTOSEEK_AT_MAX = 15.0;
const AUTOSEEK_K = (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;
class Stretch extends AbstractFifoSamplePipe {
  constructor(createBuffers) {
    super(createBuffers);
    this._quickSeek = true;
    this.midBufferDirty = false;
    this.midBuffer = null;
    this.overlapLength = 0;
    this.autoSeqSetting = true;
    this.autoSeekSetting = true;
    this._tempo = 1;
    this.setParameters(44100, DEFAULT_SEQUENCE_MS, DEFAULT_SEEKWINDOW_MS, DEFAULT_OVERLAP_MS);
  }
  clear() {
    super.clear();
    this.clearMidBuffer();
  }
  clearMidBuffer() {
    if (this.midBufferDirty) {
      this.midBufferDirty = false;
      this.midBuffer = null;
    }
  }
  setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs) {
    if (sampleRate > 0) {
      this.sampleRate = sampleRate;
    }
    if (overlapMs > 0) {
      this.overlapMs = overlapMs;
    }
    if (sequenceMs > 0) {
      this.sequenceMs = sequenceMs;
      this.autoSeqSetting = false;
    } else {
      this.autoSeqSetting = true;
    }
    if (seekWindowMs > 0) {
      this.seekWindowMs = seekWindowMs;
      this.autoSeekSetting = false;
    } else {
      this.autoSeekSetting = true;
    }
    this.calculateSequenceParameters();
    this.calculateOverlapLength(this.overlapMs);
    this.tempo = this._tempo;
  }
  set tempo(newTempo) {
    let intskip;
    this._tempo = newTempo;
    this.calculateSequenceParameters();
    this.nominalSkip = this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    intskip = Math.floor(this.nominalSkip + 0.5);
    this.sampleReq = Math.max(intskip + this.overlapLength, this.seekWindowLength) + this.seekLength;
  }
  get tempo() {
    return this._tempo;
  }
  get inputChunkSize() {
    return this.sampleReq;
  }
  get outputChunkSize() {
    return this.overlapLength + Math.max(0, this.seekWindowLength - 2 * this.overlapLength);
  }
  calculateOverlapLength(overlapInMsec = 0) {
    let newOvl;
    newOvl = this.sampleRate * overlapInMsec / 1000;
    newOvl = newOvl < 16 ? 16 : newOvl;
    newOvl -= newOvl % 8;
    this.overlapLength = newOvl;
    this.refMidBuffer = new Float32Array(this.overlapLength * 2);
    this.midBuffer = new Float32Array(this.overlapLength * 2);
  }
  checkLimits(x, mi, ma) {
    return x < mi ? mi : x > ma ? ma : x;
  }
  calculateSequenceParameters() {
    let seq;
    let seek;
    if (this.autoSeqSetting) {
      seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
      this.sequenceMs = Math.floor(seq + 0.5);
    }
    if (this.autoSeekSetting) {
      seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
      this.seekWindowMs = Math.floor(seek + 0.5);
    }
    this.seekWindowLength = Math.floor(this.sampleRate * this.sequenceMs / 1000);
    this.seekLength = Math.floor(this.sampleRate * this.seekWindowMs / 1000);
  }
  set quickSeek(enable) {
    this._quickSeek = enable;
  }
  clone() {
    const result = new Stretch();
    result.tempo = this._tempo;
    result.setParameters(this.sampleRate, this.sequenceMs, this.seekWindowMs, this.overlapMs);
    return result;
  }
  seekBestOverlapPosition() {
    return this._quickSeek ? this.seekBestOverlapPositionStereoQuick() : this.seekBestOverlapPositionStereo();
  }
  seekBestOverlapPositionStereo() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let i = 0;
    this.preCalculateCorrelationReferenceStereo();
    bestOffset = 0;
    bestCorrelation = Number.MIN_VALUE;
    for (; i < this.seekLength; i = i + 1) {
      correlation = this.calculateCrossCorrelationStereo(2 * i, this.refMidBuffer);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }
    return bestOffset;
  }
  seekBestOverlapPositionStereoQuick() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let scanCount = 0;
    let correlationOffset;
    let tempOffset;
    this.preCalculateCorrelationReferenceStereo();
    bestCorrelation = Number.MIN_VALUE;
    bestOffset = 0;
    correlationOffset = 0;
    tempOffset = 0;
    for (; scanCount < 4; scanCount = scanCount + 1) {
      let j = 0;
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = correlationOffset + _SCAN_OFFSETS[scanCount][j];
        if (tempOffset >= this.seekLength) {
          break;
        }
        correlation = this.calculateCrossCorrelationStereo(2 * tempOffset, this.refMidBuffer);
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
        j = j + 1;
      }
      correlationOffset = bestOffset;
    }
    return bestOffset;
  }
  preCalculateCorrelationReferenceStereo() {
    let i = 0;
    let context;
    let temp;
    for (; i < this.overlapLength; i = i + 1) {
      temp = i * (this.overlapLength - i);
      context = i * 2;
      this.refMidBuffer[context] = this.midBuffer[context] * temp;
      this.refMidBuffer[context + 1] = this.midBuffer[context + 1] * temp;
    }
  }
  calculateCrossCorrelationStereo(mixingPosition, compare) {
    const mixing = this._inputBuffer.vector;
    mixingPosition += this._inputBuffer.startIndex;
    let correlation = 0;
    let i = 2;
    const calcLength = 2 * this.overlapLength;
    let mixingOffset;
    for (; i < calcLength; i = i + 2) {
      mixingOffset = i + mixingPosition;
      correlation += mixing[mixingOffset] * compare[i] + mixing[mixingOffset + 1] * compare[i + 1];
    }
    return correlation;
  }
  overlap(overlapPosition) {
    this.overlapStereo(2 * overlapPosition);
  }
  overlapStereo(inputPosition) {
    const input = this._inputBuffer.vector;
    inputPosition += this._inputBuffer.startIndex;
    const output = this._outputBuffer.vector;
    const outputPosition = this._outputBuffer.endIndex;
    let i = 0;
    let context;
    let tempFrame;
    const frameScale = 1 / this.overlapLength;
    let fi;
    let inputOffset;
    let outputOffset;
    for (; i < this.overlapLength; i = i + 1) {
      tempFrame = (this.overlapLength - i) * frameScale;
      fi = i * frameScale;
      context = 2 * i;
      inputOffset = context + inputPosition;
      outputOffset = context + outputPosition;
      output[outputOffset + 0] = input[inputOffset + 0] * fi + this.midBuffer[context + 0] * tempFrame;
      output[outputOffset + 1] = input[inputOffset + 1] * fi + this.midBuffer[context + 1] * tempFrame;
    }
  }
  process() {
    let offset;
    let temp;
    let overlapSkip;
    if (this.midBuffer === null) {
      if (this._inputBuffer.frameCount < this.overlapLength) {
        return;
      }
      this.midBuffer = new Float32Array(this.overlapLength * 2);
      this._inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);
    }
    while (this._inputBuffer.frameCount >= this.sampleReq) {
      offset = this.seekBestOverlapPosition();
      this._outputBuffer.ensureAdditionalCapacity(this.overlapLength);
      this.overlap(Math.floor(offset));
      this._outputBuffer.put(this.overlapLength);
      temp = this.seekWindowLength - 2 * this.overlapLength;
      if (temp > 0) {
        this._outputBuffer.putBuffer(this._inputBuffer, offset + this.overlapLength, temp);
      }
      const start = this._inputBuffer.startIndex + 2 * (offset + this.seekWindowLength - this.overlapLength);
      this.midBuffer.set(this._inputBuffer.vector.subarray(start, start + 2 * this.overlapLength));
      this.skipFract += this.nominalSkip;
      overlapSkip = Math.floor(this.skipFract);
      this.skipFract -= overlapSkip;
      this._inputBuffer.receive(overlapSkip);
    }
  }
}

const testFloatEqual = function (a, b) {
  return (a > b ? a - b : b - a) > 1e-10;
};

class SoundTouch {
  constructor() {
    this.transposer = new RateTransposer(false);
    this.stretch = new Stretch(false);
    this._inputBuffer = new FifoSampleBuffer();
    this._intermediateBuffer = new FifoSampleBuffer();
    this._outputBuffer = new FifoSampleBuffer();
    this._rate = 0;
    this._tempo = 0;
    this.virtualPitch = 1.0;
    this.virtualRate = 1.0;
    this.virtualTempo = 1.0;
    this.calculateEffectiveRateAndTempo();
  }
  clear() {
    this.transposer.clear();
    this.stretch.clear();
  }
  clone() {
    const result = new SoundTouch();
    result.rate = this.rate;
    result.tempo = this.tempo;
    return result;
  }
  get rate() {
    return this._rate;
  }
  set rate(rate) {
    this.virtualRate = rate;
    this.calculateEffectiveRateAndTempo();
  }
  set rateChange(rateChange) {
    this._rate = 1.0 + 0.01 * rateChange;
  }
  get tempo() {
    return this._tempo;
  }
  set tempo(tempo) {
    this.virtualTempo = tempo;
    this.calculateEffectiveRateAndTempo();
  }
  set tempoChange(tempoChange) {
    this.tempo = 1.0 + 0.01 * tempoChange;
  }
  set pitch(pitch) {
    this.virtualPitch = pitch;
    this.calculateEffectiveRateAndTempo();
  }
  set pitchOctaves(pitchOctaves) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves);
    this.calculateEffectiveRateAndTempo();
  }
  set pitchSemitones(pitchSemitones) {
    this.pitchOctaves = pitchSemitones / 12.0;
  }
  get inputBuffer() {
    return this._inputBuffer;
  }
  get outputBuffer() {
    return this._outputBuffer;
  }
  calculateEffectiveRateAndTempo() {
    const previousTempo = this._tempo;
    const previousRate = this._rate;
    this._tempo = this.virtualTempo / this.virtualPitch;
    this._rate = this.virtualRate * this.virtualPitch;
    if (testFloatEqual(this._tempo, previousTempo)) {
      this.stretch.tempo = this._tempo;
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.transposer.rate = this._rate;
    }
    if (this._rate > 1.0) {
      if (this._outputBuffer != this.transposer.outputBuffer) {
        this.stretch.inputBuffer = this._inputBuffer;
        this.stretch.outputBuffer = this._intermediateBuffer;
        this.transposer.inputBuffer = this._intermediateBuffer;
        this.transposer.outputBuffer = this._outputBuffer;
      }
    } else {
      if (this._outputBuffer != this.stretch.outputBuffer) {
        this.transposer.inputBuffer = this._inputBuffer;
        this.transposer.outputBuffer = this._intermediateBuffer;
        this.stretch.inputBuffer = this._intermediateBuffer;
        this.stretch.outputBuffer = this._outputBuffer;
      }
    }
  }
  process() {
    if (this._rate > 1.0) {
      this.stretch.process();
      this.transposer.process();
    } else {
      this.transposer.process();
      this.stretch.process();
    }
  }
}

class WebAudioBufferSource {
  constructor(buffer) {
    this.buffer = buffer;
    this._position = 0;
  }
  get dualChannel() {
    return this.buffer.numberOfChannels > 1;
  }
  get position() {
    return this._position;
  }
  set position(value) {
    this._position = value;
  }
  extract(target, numFrames = 0, position = 0) {
    this.position = position;
    let left = this.buffer.getChannelData(0);
    let right = this.dualChannel ? this.buffer.getChannelData(1) : this.buffer.getChannelData(0);
    let i = 0;
    for (; i < numFrames; i++) {
      target[i * 2] = left[i + position];
      target[i * 2 + 1] = right[i + position];
    }
    return Math.min(numFrames, left.length - position);
  }
}

const getWebAudioNode = function (context, filter, sourcePositionCallback = noop, bufferSize = 4096) {
  const node = context.createScriptProcessor(bufferSize, 2, 2);
  const samples = new Float32Array(bufferSize * 2);
  node.onaudioprocess = event => {
    let left = event.outputBuffer.getChannelData(0);
    let right = event.outputBuffer.getChannelData(1);
    let framesExtracted = filter.extract(samples, bufferSize);
    sourcePositionCallback(filter.sourcePosition);
    if (framesExtracted === 0) {
      filter.onEnd();
    }
    let i = 0;
    for (; i < framesExtracted; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  };
  return node;
};

const pad = function (n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};
const minsSecs = function (secs) {
  const mins = Math.floor(secs / 60);
  const seconds = secs - mins * 60;
  return `${mins}:${pad(parseInt(seconds), 2)}`;
};

const onUpdate = function (sourcePosition) {
  const currentTimePlayed = this.timePlayed;
  const sampleRate = this.sampleRate;
  this.sourcePosition = sourcePosition;
  this.timePlayed = sourcePosition / sampleRate;
  if (currentTimePlayed !== this.timePlayed) {
    const timePlayed = new CustomEvent('play', {
      detail: {
        timePlayed: this.timePlayed,
        formattedTimePlayed: this.formattedTimePlayed,
        percentagePlayed: this.percentagePlayed
      }
    });
    this._node.dispatchEvent(timePlayed);
  }
};
class PitchShifter {
  constructor(context, buffer, bufferSize, onEnd = noop) {
    this._soundtouch = new SoundTouch();
    const source = new WebAudioBufferSource(buffer);
    this.timePlayed = 0;
    this.sourcePosition = 0;
    this._filter = new SimpleFilter(source, this._soundtouch, onEnd);
    this._node = getWebAudioNode(context, this._filter, sourcePostion => onUpdate.call(this, sourcePostion), bufferSize);
    this.tempo = 1;
    this.rate = 1;
    this.duration = buffer.duration;
    this.sampleRate = context.sampleRate;
    this.listeners = [];
  }
  get formattedDuration() {
    return minsSecs(this.duration);
  }
  get formattedTimePlayed() {
    return minsSecs(this.timePlayed);
  }
  get percentagePlayed() {
    return 100 * this._filter.sourcePosition / (this.duration * this.sampleRate);
  }
  set percentagePlayed(perc) {
    this._filter.sourcePosition = parseInt(perc * this.duration * this.sampleRate);
    this.sourcePosition = this._filter.sourcePosition;
    this.timePlayed = this.sourcePosition / this.sampleRate;
  }
  get node() {
    return this._node;
  }
  set pitch(pitch) {
    this._soundtouch.pitch = pitch;
  }
  set pitchSemitones(semitone) {
    this._soundtouch.pitchSemitones = semitone;
  }
  set rate(rate) {
    this._soundtouch.rate = rate;
  }
  set tempo(tempo) {
    this._soundtouch.tempo = tempo;
  }
  connect(toNode) {
    this._node.connect(toNode);
  }
  disconnect() {
    this._node.disconnect();
  }
  on(eventName, cb) {
    this.listeners.push({
      name: eventName,
      cb: cb
    });
    this._node.addEventListener(eventName, event => cb(event.detail));
  }
  off(eventName = null) {
    let listeners = this.listeners;
    if (eventName) {
      listeners = listeners.filter(e => e.name === eventName);
    }
    listeners.forEach(e => {
      this._node.removeEventListener(e.name, event => e.cb(event.detail));
    });
  }
}

class PlaybackInterruptedError extends Error {
    constructor(...args) {
        super(...args);
    }
}

class AudioPlayback {
    constructor() {
        this.tempo          = 1.;
        this.pitch          = 1.;
        this.volume         = 1.;
        this.cutoff         = 0;
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

        const end = Math.min(parseInt(-1 * this.cutoff * 4200), -1);
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

class GoogleTranslateTTS {
    constructor(_fetch) {
        this.fetchText    = _fetch ?? this.fetchText;
        this.language     = 'en';
        this.speed        = 1.;
        this.maxChars     = 195;
        this.filterCommas = false;
    }

    fetchText(...args) {
        return fetch(...args).then(response => response.text());
    }

    parseAudioData(textData) {
        return Uint8Array.from(atob(textData), (e) => e.charCodeAt(0));
    }

    splitText(text) {
        if (text.length < this.maxChars)
            return text.length
        let splits = [...text.matchAll(/[\,\?\;\:\!\.]/g)];
        for (let i = 0; i < splits.length - 1; i++) {
            if (splits[i+1].index > this.maxChars && splits[i].index <= this.maxChars) {
                return splits[i].index
        }   }
        splits = [...text.matchAll(/\s/g)];
        const spliti = Math.min(this.maxChars, text.length/2);
        for (let i = 0; i < splits.length - 1; i++) {
            if (splits[i+1].index > spliti && splits[i].index <= spliti) {
                return splits[i].index
        }   }
        throw "text is too long";
    }

    async fetchAudio(text) {
        text = text.replace(/\s+/g, " "); 
        if (!text.endsWith("."))
            text += ".";
        let audios = "";
        while (true) {
            const index = this.splitText(text); 
            const splitText = text.slice(0       , index+1);
            text = text.slice(index+2);
            if (this.filterCommas)
                splitText = splitText.replace(",", "");
            audios += await this.fetchAudioRaw(splitText);
            if (!text)
                break;
        } 
        return this.parseAudioData(audios);
    }

    fetchAudioRaw(text) {
        const url = "https://www.google.com/async/translate_tts?" +
                    `ttsp=tl:${this.language},txt:${encodeURIComponent(encodeURIComponent(text))},spd:${this.speed}`;
        return this.fetchText(url) .then(text => {
            const jresp = JSON.parse(text.split("\n")[1]);
            const audioData = jresp['translate_tts']['tts_data'];
            return audioData; 
        })
    }
}

class PageReaderBase {
    getStartElement() {
        return window.getSelection().anchorNode.parentElement;
    }

    getElementText(elem) {
        return elem.textContent;
    }

    splitSentence(text) {
        const match = text.match(/[a-zA-Z0-9\]\)] ?[\?\;\:\!\.] [A-Z]/m);
        if (match) {
            return match.index + 3;
        } 
        if (text.match(/[a-zA-Z0-9\]\)] ?[\?\;\:\!\.]\s*$/m))
            return text.length;

        return text.length + 1;
    }

    #getNextElement(elem, i=0) {
        const parent = elem.parentElement;
        if (!parent)
            return [null, i];
        const j = [...parent.children].indexOf(elem);
        if (j + 1 >= parent.children.length)  
            return this.#getNextElement(parent, i+1);
        elem = parent.children[j + 1];
        while (elem.children.length) {
            elem = elem.children[0];
            i -= 1;
        }
        if (this.getElementText(elem))
            return [elem, i];
        else
            return this.#getNextElement(elem, i)
    }

    *iterElements() {
        let elem = this.getStartElement();
        if (!elem) {
            console.warn("no readable element found!");
            return;
        }
        yield elem;

        let i = 0;
        while (i < 20) {
            [elem, i] = this.#getNextElement(elem, i);
            if (!elem) return;
            yield elem;
        }
    }
}

class PageReaderWebsite extends PageReaderBase {
    getElementText(elem) {
        return elem.textContent;
    }

    isSentence(text) {
        text = text.replace(/ +/g, ' '); // remove adjacent spaces
        const words = text.split(' ');
        if (words.length < 3) return false;
        return true;
    }

    isHeadingElement(element) {
        return /^H\d$/i.test(element.tagName);
    }

    *iterParagraph(elem, elems) {
        const text = elems.map(e => this.getElementText(e)).reduce((a, t) => a + t, '');
        if (this.isSentence(text) || this.isHeadingElement(elem))
            yield {sentence: text, elems:elems, start:0, end:elems[elems.length-1].length};
    }

    *iterElements(elem, adjacent=false, parent=false) {
        let elems = [];
        for (const child of elem.childNodes) {
            if (child.nodeType == Node.TEXT_NODE) 
                elems.push(child);
            else {
                const childElems = Array.from(this.iterElements(child));
                if (childElems.length == 0) 
                    elems.push(child);
                else {
                    yield* this.iterParagraph(elem, elems);
                    yield* childElems;
                    elems = [];
                }
            }
        }
        yield* this.iterParagraph(elem, elems);

        if (adjacent && elem.nextElementSibling) {
            yield* this.iterElements(elem.nextElementSibling, true, true);
            return;
        }

        if (!parent) return;
        while (elem.parentNode && !elem.parentNode.nextElementSibling) 
            elem = elem.parentNode;

        if (elem.parentNode) 
            yield* this.iterElements(elem.parentNode.nextElementSibling, true, true);
    }

    *iterSentences() {
        yield* this.iterElements(this.getStartElement(), true, true);
    }
}


class TextSelectionHighlighter {
    getTextNode(elem) {
        if (elem.nodeType == Node.TEXT_NODE)
            return elem;
        if (elem.childNodes.length > 0)
            return this.getTextNode(elem.childNodes[0]);
        throw "not a text node";
    }

    highlight(elems, start, end) {
        try {
            const first = elems[0]; 
            const last  = elems[elems.length - 1];
            const firstText = this.getTextNode(first);
            const lastText  = this.getTextNode(last);
            end = end === undefined ? lastText.length : end;
            var range = document.createRange();
            range.setStart(firstText, Math.min(start, firstText.length));
            range.setEnd  ( lastText, Math.min(end  ,  lastText.length));
            
            var selection = document.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch {
            console.warn("failed to set text selection", range); 
        }
    }

    unhighlight(elems) {
        var selection = document.getSelection();
        selection.removeAllRanges();
    }
}

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

class TTSReader {
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

function backgroundFetch(...args)  {
    return chrome.runtime.sendMessage({method: "fetch", args:args});
}

window.ttsController = new TTSController(
    new TTSReader(
        new PageReaderWebsite(), 
        new TextSelectionHighlighter(),
        new AudioPlayback(),
        new GoogleTranslateTTS(backgroundFetch),
    )
);
