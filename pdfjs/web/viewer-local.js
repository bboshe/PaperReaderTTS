const showViewer = null;localStorage.getItem("local-files-show-viewer");

if (showViewer === null) {
    if (confirm("Can not open .pdf files from disk due to security policies.\n" +
                "Files from disk have to be opend directly from the PDF viewer.\n\n" +
                "Open the PDF viewer now?")) {
        localStorage.setItem("local-files-show-viewer", true);
        showViewer = true;
    } else {
        localStorage.setItem("local-files-show-viewer", false);
        showViewer = false;
    }
}

if (showViewer) {
    window.location.href = "viewer.html?file="
} else {
    window.location.href = (new URLSearchParams(window.location.search)).get("file")
}
