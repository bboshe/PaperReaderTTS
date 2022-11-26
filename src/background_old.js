import {GoogleTranslateTTS}  from '/src_common/google_tts.js' 
import {AudioPlayback}       from '/src_common/audio.js' 
import {TTSReader}           from '/src_common/tts.js' 
import {ObjectPublisher, connectToObject}     from '/src_common/objcon.js';



class LocalStorageDumper {
    constructor(objects) {
        this.objects = objects;
    }

    async loadObjectState(obj) {
        const keys = Object.keys(obj).filter(k => ["string", "number", "boolean"].includes(typeof(obj[k])));
        const lskeys = keys.map(key => obj.constructor.name + "." + key);
        const values = await chrome.storage.local.get(lskeys);
        for (const lskey of Object.keys(values)) {
            const key = keys[lskeys.indexOf(lskey)];
            obj[key] = values[lskey];
        }
    }

    loadState() {
        for (const obj of this.objects) 
            this.loadObjectState(obj);
    }

    saveObjectState(obj, prop, value) {
        const lskey = obj.constructor.name + "." + prop;
        chrome.storage.local.set({[lskey]: value});
    }
}


class PdfViewer {
    constructor() {
        this.replaceNative      = true;
        this.replaceNativeFiles = true;
        this.viewerUrl = chrome.extension.getURL("pdfjs/web/viewer.html");
        this.registerEvents();
    }

    getViewerURL(pdf_url) {
        return this.viewerUrl + "?file=" + encodeURIComponent(pdf_url);
    }

    registerEvents() {
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (this.replaceNative) {
                    return { redirectUrl: this.getViewerURL(details.url) };
                }
            }, {
                urls : [ "*://*/*.pdf", "*://*/*.PDF", ],
                types: ["main_frame"],
            }, ["blocking"]
        );

        chrome.webNavigation.onBeforeNavigate.addListener(
            (details) => {
                if (this.replaceNativeFiles) {
                    chrome.tabs.update(details.tabId, {
                        url: this.getViewerURL("") 
          //            url: chrome.extension.getURL("pdfjs/web/viewer-local.html") 
          //                + "?file=" + encodeURIComponent(details.url) 
                    });
                }
            } , {
            url: [ { urlPrefix: "file://", pathSuffix: ".pdf", }, 
                    { urlPrefix: "file://", pathSuffix: ".PDF", }, ], 
            }
        );
    }
}

class TTSController {

}




chrome.runtime.onInstalled.addListener(() => {

    const ttsEngine     = new GoogleTranslateTTS();
    const audioPlayback = new AudioPlayback();
    const ttsReader     = new TTSReader(ttsEngine, audioPlayback);

    const pdfViewer = new PdfViewer();

    const objDumper = new LocalStorageDumper([ttsEngine, audioPlayback, ttsReader]);
    objDumper.loadState();



    window.publischer = new ObjectPublisher(chrome.runtime, {
        "ttsEngine"     : ttsEngine,
        "audioPlayback" : audioPlayback,
        "ttsReader"     : ttsReader,
        "pdfViewer"     : pdfViewer,
    });
    window.publischer.onPropWrite = objDumper.saveObjectState


    chrome.contextMenus.create({
        title: "Read Aloud",
        id: "item-speak",
        icons: { "64": "icon/main-64.png"},
        contexts: ["page", "selection"],
    }) 

    chrome.contextMenus.onClicked.addListener(async function(info, tab) {
        if (info.menuItemId === "item-speak") { 
            let results = await chrome.scripting.executeScript( {
                target: {tabId: tab.id},
                files: ["/src/content.js"],
            })
            console.log("result", results);
            let pageReader = await connectToObject(chrome.runtime, "pageReader");
            await pageReader.select();
            await pageReader.nextSentence();

            console.log("asdf", results);
        }
    });
})


