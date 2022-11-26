class PdfViewerController {
    constructor() {
        this.replaceNativeViewer = true;
        this.viewerUrl = chrome.runtime.getURL("pdfjs/web/viewer.html");
//        this.viewerUrl = "https://mozilla.github.io/pdf.js/web/viewer.html"
        this.registerEvents();
    }

    getViewerURL(pdf_url) {
        return this.viewerUrl + "?file=" + encodeURIComponent(pdf_url);
    }

    registerEvents() {
        chrome.storage.local.onChanged.addListener((changes, areaName) => {
            if ("replace-viewer" in changes) {
                this.replaceNativeViewer = changes["replace-viewer"].newValue;
            }
        });
        chrome.webNavigation.onCommitted.addListener(
            async (details) => {
                if (this.replaceNativeViewer) {
                    chrome.tabs.update(details.tabId, {
                        url: this.getViewerURL(details.url)
                    });
                }
            } , {
                url: [ {  pathSuffix: ".pdf", }, { pathSuffix: ".PDF", }, ], 
            }
        );
    }
}

const viewer = new PdfViewerController();


chrome.contextMenus.create({
    title: "Read Aloud",
    id: "item-speak",
    contexts: ["selection"],
}) 


chrome.scripting.registerContentScripts([ {
    id: 'reader-content-script',
    matches: ['http://*/*', 'https://*/*'],
    js: ['src/content.html.bundled.js'],
//    runAt: 'document_start',
//    world: 'MAIN',
}])


//chrome.storage.local.onChanged.addListener((changes, areaName) => {
//    chrome.runtime.sendMessage({method: "local-storage-changed", args:[changes, areaName]});
//});
chrome.commands     .onCommand.addListener((command, tab) => {
    chrome.tabs.sendMessage(tab.id, {method: "command", args:[command, tab]});
});
chrome.contextMenus .onClicked.addListener((info, tab) => {
    chrome.tabs.sendMessage(tab.id, {method: "context-menu-clicked", args:[info, tab]});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.method === "fetch") {
        fetch(...message.args).then(response => response.text()).then(text => {sendResponse(text);});
        return true;
    }
});