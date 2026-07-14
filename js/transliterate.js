class Transliterator {
    static TELUGU_START = 0x0C00;
    static TELUGU_END = 0x0C7F;
    static UNICODE_OFFSET = 0x0300; 

    /**
     * Converts text from Telugu to Devanagari.
     * Respects escape syntax {} to preserve specific text blocks.
     */
    static convert(text) {
        if (!text) return '';
        
        let result = '';
        let isEscaped = false;

        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i);
            let char = text[i];

            // Handle state toggles for escape parsing
            if (char === '{') {
                isEscaped = true;
                continue; // Skip rendering the brace
            }
            if (char === '}') {
                isEscaped = false;
                continue; // Skip rendering the brace
            }

            // If inside {}, append directly without translation
            if (isEscaped) {
                result += char;
                continue;
            }

            // Standard transliteration logic
            if (charCode >= this.TELUGU_START && charCode <= this.TELUGU_END) {
                result += String.fromCharCode(charCode - this.UNICODE_OFFSET);
            } else {
                result += char;
            }
        }
        return result;
    }
}