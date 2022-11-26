
export class TTSController {
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


