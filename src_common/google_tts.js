export class GoogleTranslateTTS {
    constructor(_fetch) {
        this.fetchText    = _fetch ?? this.fetchText;
        this.language     = 'en'
        this.speed        = 1.
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
        for (let i = 0; i < splits.length - 1; i++) {
            if (splits[i+1].index > this.maxChars && splits[i].index <= this.maxChars) {
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
        return this.fetchText('https://www.google.com/async/translate_tts?' + 
            new URLSearchParams({
                'ttsp':	`tl:${this.language},txt:${encodeURIComponent(text)},spd:${this.speed}`
            }
        ), {
            method: 'GET',
            headers: {},
        })
        .then(text => {
            const jresp = JSON.parse(text.split("\n")[1]);
            const audioData = jresp['translate_tts']['tts_data'];
            return audioData; 
        })
    }
}
