import { TTSController           } from "./content.js";
import { TTSReader               } from "../src_common/tts.js";
import { AudioPlayback           } from "../src_common/audio.js";
import { GoogleTranslateTTS      } from "../src_common/google_tts.js"
import { PageReaderWebsite, 
         TextSelectionHighlighter} from "../src_common/reader.js";


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


