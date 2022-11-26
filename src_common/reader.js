function *iterSlidingWindow(iter, window) {
    let items = [];
    let result = null;
    for (let i = 0; i < window-1; i++) {
        result = iter.next();
        if (result.done) return;
        items.push(result.value);
    }
    while (!result.done) {
        result = iter.next();
        if (result.done) return;
        items.push(result.value);
        yield [...items];
        items.shift();
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
            elem = elem.children[0]
            i -= 1
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

        let i = 0
        while (i < 20) {
            [elem, i] = this.#getNextElement(elem, i);
            if (!elem) return;
            yield elem
        }
    }
}

export class PageReaderPdf extends PageReaderBase {
    constructor() {
        super();
        this.titleSize      = 1.05;
        this.titleWordCount = 1;
    }

    #sameLine(current, next) {
        const currentRact = current.getBoundingClientRect();
        const nextRact    = next.getBoundingClientRect();
        const fontSize = parseFloat(current.style.fontSize)
        const boolX = -fontSize*0.5 < nextRact.left - currentRact.right && nextRact.left - currentRact.right < fontSize*2; 
        const boolY0 = fontSize*0.5 > nextRact.top  - currentRact.top;
        const boolY1 = fontSize*0.5 > currentRact.bottom - nextRact.bottom;
        return boolX && boolY0 && boolY1
    }

    #isTitle(current, next) {
        const fontSize = parseFloat(current.style.fontSize)
        const fontSize2 = parseFloat(next.style.fontSize)
        const wordCount = this.getElementText(current).trim().split(" ").length
        return !this.#sameLine(current, next) && wordCount >= this.titleWordCount && fontSize / fontSize2 > this.titleSize;
    }

    *iterSentences() {
        let sentence = ""; let elements  = []; let startOffset = 0;
        for (const [elem, next] of iterSlidingWindow(this.iterElements(), 2)) {
            const text = this.getElementText(elem);
            sentence += text;
            elements.push(elem);
            if (this.#isTitle(elem, next)) {
                yield {sentence: sentence, elems:[...elements], start:startOffset, end:startOffset + sentence.length};
                sentence = ""; elements  = []; startOffset = 0;
            } else {
                while (sentence) {
                    const splitIndex = this.splitSentence(sentence);
                    if (splitIndex > sentence.length) {
                        if (!this.#sameLine(elem, next)) 
                            sentence += " ";
                        sentence = sentence.replace(/-\s*$/gm, "");
                        break;
                    }
                    const endOff = splitIndex -  sentence.length + text.length;
                    yield {sentence: sentence.slice(0, splitIndex), elems:[...elements], start:startOffset, end:endOff};
                    sentence = sentence.slice(splitIndex);
                    startOffset = sentence ? endOff : 0;
                    elements  = sentence ? [elem] : [];
                }
            }
        }
    }
}

export class PageReaderWebsite extends PageReaderBase {
    *iterSentences() {
        for (const elem of this.iterElements()) {
            const text = this.getElementText(elem);
            let startOffset = 0
            while (startOffset < text.length) {
                const splitIndex = this.splitSentence(text.slice(startOffset)) + startOffset;
                const sentence = text.slice(startOffset, splitIndex);
                yield {sentence: sentence, elems: [elem], start:startOffset, end:splitIndex};
                startOffset = splitIndex;
            } 
        }
    }
}

export class TextSelectionHighlighter {
    highlight(elems, start, end) {
        try {
            const first = elems[0]; 
            const last  = elems[elems.length - 1];
            const firstText = first.childNodes[0];
            const lastText  = last .childNodes[0];
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

