
class RangeSlider {
    constructor(element, name, _default) {
        this.input   = typeof(element) === "string" ? document.getElementById(element) : element;
        this.name    = name;
        this.default = _default;
        this.findOutput();
        this.connectOutput();
        this.connectStorage();
    }

    findOutput() {
        const outputs = this.input.parentElement.getElementsByTagName("output");
        if (outputs.length == 0) return;
        this.output = outputs[0];
    }

    connectOutput() {
        this.input.addEventListener('input', (event) => {
            this.output && (this.output.value = this.input.value); });
    }

    connectStorage() {
        chrome.storage.local.get({[this.name]: this.default})
            .then(data => {this.value = data[this.name];});
        this.input.addEventListener('change', (event) => {
            chrome.storage.local.set({[this.name]: parseFloat(this.value)});
        });
    }

    get value() {
        return this.input.value;
    }

    set value(value) {
        this.input.value = value;
        this.output && (this.output.value = value);
    }
}


class PopupController {
    constructor() {
        this.findElements();
        this.connectElements();
    }

    findElements() {
        this.selectLanguage = document.getElementById("select-language");
        this.rangeTempo     = new RangeSlider("range-tempo" , "audio-tempo" , 1.);
        this.rangeVolume    = new RangeSlider("range-volume", "audio-volume", 1.);
        this.rangePitch     = new RangeSlider("range-pitch" , "audio-pitch" , 0.);
        this.rangeDelay     = new RangeSlider("range-delay" , "audio-delay" , 0.);
        this.checkComma     = document.getElementById("check-comma");
        this.checkSkipWords = document.getElementById("check-skip-words");
        this.checkSkipURLs  = document.getElementById("check-skip-url");
        this.checkSkipCite  = document.getElementById("check-skip-citations");
        this.checkViewer    = document.getElementById("check-viewer");
        this.buttonViewer   = document.getElementById("button-viewer");
    }

    connectElement(element, name, _default, key) {
        chrome.storage.local.get({[name]: _default})
            .then(data => {element[key] = data[name];});
        element.addEventListener('change', (event) => {
            chrome.storage.local.set({[name]: element[key]});
        });
    }

    connectElements() {
        this.connectElement(this.selectLanguage, "tts-language"  , "en" , "value");
        this.connectElement(this.checkComma    , "tts-skip-comma", false, "checked");
        this.connectElement(this.checkSkipWords, "tts-skip-words", true , "checked");
        this.connectElement(this.checkSkipURLs , "tts-skip-url"  , true , "checked");
        this.connectElement(this.checkSkipCite , "tts-skip-cite" , true , "checked");
        this.connectElement(this.checkViewer   , "replace-viewer", true , "checked");
        this.buttonViewer.addEventListener('click', async (event) => {
            const url = chrome.runtime.getURL("pdfjs/web/viewer.html");
            window.open(url + "?file=", '_blank').focus();
            window.close();
        });
    }

}

window.addEventListener('load', (event) => {
    window.popupController = new PopupController();
});

