import { TTSController           } from "./content.js";
import { TTSReader               } from "../src_common/tts.js";
import { AudioPlayback           } from "../src_common/audio.js";
import { GoogleTranslateTTS      } from "../src_common/google_tts.js"
import { PageReaderPdf, 
         TextSelectionHighlighter} from "../src_common/reader.js";


window.ttsController = new TTSController(
    new TTSReader(
        new PageReaderPdf(), 
        new TextSelectionHighlighter(),
        new AudioPlayback(),
        new GoogleTranslateTTS(),
    )
);


