class Transliterator {
    static TELUGU_START = 0x0C00;
    static TELUGU_END = 0x0C7F;
    static DEVANAGARI_START = 0x0900;
    static DEVANAGARI_END = 0x097F;
    static UNICODE_OFFSET = 0x0300; 

    /**
     * Converts text bidirectionally between Telugu and Devanagari.
     * @param {string} text - Input text
     * @param {string} direction - 'TE_TO_HI' or 'HI_TO_TE'
     */
    static convert(text, direction = 'TE_TO_HI') {
        if (!text) return '';
        
        let result = '';
        let isEscaped = false;

        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i);
            let char = text[i];

            if (char === '{') { isEscaped = true; continue; }
            if (char === '}') { isEscaped = false; continue; }
            if (isEscaped) { result += char; continue; }

            if (direction === 'TE_TO_HI' && charCode >= this.TELUGU_START && charCode <= this.TELUGU_END) {
                result += String.fromCharCode(charCode - this.UNICODE_OFFSET);
            } else if (direction === 'HI_TO_TE' && charCode >= this.DEVANAGARI_START && charCode <= this.DEVANAGARI_END) {
                result += String.fromCharCode(charCode + this.UNICODE_OFFSET);
            } else {
                result += char;
            }
        }
        return result;
    }
}
