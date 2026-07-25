class Transliterator {
    // Standardized Unicode block bases for all Brahmi-derived scripts
    static BASES = {
        'hi': 0x0900, // Devanagari (Hindi)
        'ta': 0x0B80, // Tamil
        'te': 0x0C00, // Telugu
        'kn': 0x0C80, // Kannada
        'ml': 0x0D00  // Malayalam
    };

    /**
     * Mathematically converts text between any two supported Indian scripts.
     * Respects escape syntax {} to preserve specific text blocks.
     */
    static convert(text, sourceLang, targetLang) {
        if (!text || sourceLang === targetLang) return text;

        const sourceBase = this.BASES[sourceLang];
        const targetBase = this.BASES[targetLang];

        if (!sourceBase || !targetBase) return text; // Fallback if language is missing
        
        let result = '';
        let isEscaped = false;

        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i);
            let char = text[i];

            if (char === '{') {
                isEscaped = true;
                continue;
            }
            if (char === '}') {
                isEscaped = false;
                continue;
            }
            if (isEscaped) {
                result += char;
                continue;
            }

            // If the character falls within the source language's 128-character Unicode block
            if (charCode >= sourceBase && charCode <= sourceBase + 0x007F) {
                // Find mathematical offset and apply to target base
                const offset = charCode - sourceBase;
                result += String.fromCharCode(targetBase + offset);
            } else {
                result += char; // Retain spaces, English letters, and numbers
            }
        }
        return result;
    }
}
