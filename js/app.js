document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
    }

    // UI Elements
    const inputElement = document.getElementById('teluguInput');
    const outputElement = document.getElementById('devanagariOutput');
    const inputLangSelect = document.getElementById('inputLang');
    const outputLangSelect = document.getElementById('outputLang');
    
    // Headers & Toolbars
    const box1Header = document.getElementById('box1Header');
    const box2Header = document.getElementById('box2Header');
    const inlineSwapBtn = document.getElementById('inlineSwapBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const printBtn = document.getElementById('printBtn');
    
    // Counters
    const inputWordCount = document.getElementById('inputWordCount');
    const inputCharCount = document.getElementById('inputCharCount');
    const outputWordCount = document.getElementById('outputWordCount');
    const outputCharCount = document.getElementById('outputCharCount');

    // Settings
    const editorFontSizeSlider = document.getElementById('editorFontSize');
    const printFontSizeSlider = document.getElementById('printFontSize');
    const editorFontValue = document.getElementById('editorFontValue');
    const printFontValue = document.getElementById('printFontValue');

    // System Subsystems (File, OCR)
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const processFileBtn = document.getElementById('processFileBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStatusText = document.getElementById('progressStatusText');

    const imageInput = document.getElementById('imageInput');
    const imageDropZone = document.getElementById('imageDropZone');
    const processImageBtn = document.getElementById('processImageBtn');
    const ocrProgressContainer = document.getElementById('ocrProgressContainer');
    const ocrProgressBar = document.getElementById('ocrProgressBar');
    const ocrPercentage = document.getElementById('ocrPercentage');
    const ocrStatusText = document.getElementById('ocrStatusText');

    let currentFile = null; 
    let currentImage = null;

    const toastEl = document.getElementById('actionToast');
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });

    const STORAGE_KEY_TEXT = 'transliteration_session_data';
    const STORAGE_KEY_CONFIG = 'transliteration_config_data';
    const STORAGE_KEY_IN_LANG = 'transliteration_in_lang';
    const STORAGE_KEY_OUT_LANG = 'transliteration_out_lang';
    const PRINT_CHAR_LIMIT = 50000;

    // Load saved preferences
    inputLangSelect.value = localStorage.getItem(STORAGE_KEY_IN_LANG) || 'te';
    outputLangSelect.value = localStorage.getItem(STORAGE_KEY_OUT_LANG) || 'hi';

    // -------------------------------------------------------------
    // Dynamic Text Area Auto-Resizer
    // -------------------------------------------------------------
    const autoResize = (element) => {
        element.style.height = 'auto'; // Reset
        element.style.height = element.scrollHeight + 'px'; // Expand to fit content
    };

    // -------------------------------------------------------------
    // Web Worker Construction
    // -------------------------------------------------------------
    const workerScript = `
        ${Transliterator.toString()}
        self.onmessage = function(e) { 
            const data = e.data;
            self.postMessage(Transliterator.convert(data.text, data.sourceLang, data.targetLang)); 
        };
    `;
    const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
    const transliterationWorker = new Worker(URL.createObjectURL(workerBlob));

    let isWorkerBusy = false;
    let pendingTask = null;

    transliterationWorker.onmessage = (e) => {
        outputElement.value = e.data;
        updateCounters(e.data, outputWordCount, outputCharCount);
        autoResize(outputElement); // Resize output box dynamically
        
        isWorkerBusy = false;
        if (pendingTask !== null) {
            const taskToProcess = pendingTask;
            pendingTask = null;
            isWorkerBusy = true;
            transliterationWorker.postMessage(taskToProcess);
        }
    };

    // -------------------------------------------------------------
    // State Mutation & DOM Repainting
    // -------------------------------------------------------------
    const getLanguageName = (code) => {
        const names = { 'te': 'Telugu', 'hi': 'Hindi', 'kn': 'Kannada', 'ml': 'Malayalam', 'ta': 'Tamil' };
        return names[code] || 'Input';
    };

    const updateUIState = () => {
        const inLang = inputLangSelect.value;
        const outLang = outputLangSelect.value;
        
        box1Header.textContent = getLanguageName(inLang);
        box2Header.textContent = getLanguageName(outLang);
        
        inputElement.placeholder = `Type ${getLanguageName(inLang)} here...`;
        outputElement.placeholder = `${getLanguageName(outLang)} output...`;

        localStorage.setItem(STORAGE_KEY_IN_LANG, inLang);
        localStorage.setItem(STORAGE_KEY_OUT_LANG, outLang);
        
        if (inputElement.value) {
            dispatchToWorker(inputElement.value);
        }
    };

    inputLangSelect.addEventListener('change', updateUIState);
    outputLangSelect.addEventListener('change', updateUIState);

    // Inline Swap Functionality
    inlineSwapBtn.addEventListener('click', () => {
        const temp = inputLangSelect.value;
        inputLangSelect.value = outputLangSelect.value;
        outputLangSelect.value = temp;
        
        updateUIState();

        const currentInput = inputElement.value;
        const currentOutput = outputElement.value;
        
        if (currentOutput) {
            inputElement.value = currentOutput;
            dispatchToWorker(currentOutput);
            autoResize(inputElement);
        } else if (currentInput) {
            dispatchToWorker(currentInput);
        }
    });

    // -------------------------------------------------------------
    // Utilities & Configuration
    // -------------------------------------------------------------
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => { func.apply(null, args); }, delay); };
    };

    const updateCounters = (text, wordCounter, charCounter) => {
        charCounter.textContent = text.length;
        wordCounter.textContent = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    };

    const showToast = (message) => { document.getElementById('toastMessage').textContent = message; toast.show(); };

    const applyConfiguration = (editorSize, printSize) => {
        document.documentElement.style.setProperty('--editor-font-size', `${editorSize}rem`);
        document.documentElement.style.setProperty('--print-font-size', `${printSize}pt`);
        editorFontValue.textContent = `${editorSize}rem`; printFontValue.textContent = `${printSize}pt`;
        editorFontSizeSlider.value = editorSize; printFontSizeSlider.value = printSize;
        autoResize(inputElement);
        autoResize(outputElement);
    };

    const saveConfiguration = () => {
        const config = { editorSize: editorFontSizeSlider.value, printSize: printFontSizeSlider.value };
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
        applyConfiguration(config.editorSize, config.printSize);
    };

    editorFontSizeSlider.addEventListener('input', saveConfiguration);
    printFontSizeSlider.addEventListener('input', saveConfiguration);

    // -------------------------------------------------------------
    // Editor Pipeline
    // -------------------------------------------------------------
    const dispatchToWorker = (inputText) => {
        updateCounters(inputText, inputWordCount, inputCharCount);
        localStorage.setItem(STORAGE_KEY_TEXT, inputText);
        
        const taskPayload = { 
            text: inputText, 
            sourceLang: inputLangSelect.value, 
            targetLang: outputLangSelect.value 
        };

        if (isWorkerBusy) { pendingTask = taskPayload; } 
        else { isWorkerBusy = true; transliterationWorker.postMessage(taskPayload); }
    };

    const debouncedDispatch = debounce((text) => { dispatchToWorker(text); }, 200);

    inputElement.addEventListener('input', (event) => {
        autoResize(event.target); // Trigger vertical expansion
        debouncedDispatch(event.target.value);
    });

    const hydrateState = () => {
        updateUIState();
        const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG));
        if (savedConfig) applyConfiguration(savedConfig.editorSize, savedConfig.printSize);
        const savedText = localStorage.getItem(STORAGE_KEY_TEXT);
        if (savedText) { 
            inputElement.value = savedText; 
            autoResize(inputElement);
            dispatchToWorker(savedText); 
        }
    };

    // -------------------------------------------------------------
    // Toolbar, OCR, & File I/O Logic 
    // (Omitted unchanged subroutines for brevity, functionally identical to Phase 16)
    // -------------------------------------------------------------
    copyBtn.addEventListener('click', async () => {
        if (!outputElement.value) return;
        try { await navigator.clipboard.writeText(outputElement.value); showToast('Output text copied.'); } catch (err) {}
    });

    clearBtn.addEventListener('click', () => {
        inputElement.value = ''; outputElement.value = ''; 
        inputElement.style.height = 'auto'; outputElement.style.height = 'auto'; // Reset box sizes
        fileInput.value = ''; imageInput.value = '';
        currentFile = null; currentImage = null; pendingTask = null;
        processFileBtn.disabled = true; processImageBtn.disabled = true;
        progressContainer.classList.add('d-none'); ocrProgressContainer.classList.add('d-none');
        updateCounters('', inputWordCount, inputCharCount); updateCounters('', outputWordCount, outputCharCount);
        localStorage.removeItem(STORAGE_KEY_TEXT); inputElement.focus();
    });

    printBtn.addEventListener('click', () => {
        const printContent = outputElement.value;
        if (!printContent || printContent.length > PRINT_CHAR_LIMIT) return;
        const printSize = document.documentElement.style.getPropertyValue('--print-font-size') || '14pt';
        const iframe = document.createElement('iframe'); iframe.style.display = 'none'; document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document; doc.open();
        doc.write(`<!DOCTYPE html><html><head><style>@page { margin: 2cm; } body { font-family: sans-serif; font-size: ${printSize}; white-space: pre-wrap; word-wrap: break-word; color: #000; background: #fff; margin: 0; padding: 0; }</style></head><body>${printContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`);
        doc.close(); iframe.contentWindow.focus(); iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    });

    // File processing integration passing correct dynamic languages
    const handleFileSelection = (file) => {
        progressContainer.classList.add('d-none');
        if (file && file.name.endsWith('.txt')) { currentFile = file; processFileBtn.disabled = false; } 
        else { currentFile = null; processFileBtn.disabled = true; fileInput.value = ''; if (file) showToast('Invalid format. .txt required.'); }
    };

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active-drop'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('active-drop'); });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('active-drop'); if (e.dataTransfer.files.length > 0) { fileInput.files = e.dataTransfer.files; handleFileSelection(e.dataTransfer.files[0]); } });
    fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files.length > 0 ? e.target.files[0] : null));

    processFileBtn.addEventListener('click', () => {
        if (!currentFile) return;
        const reader = new FileReader();
        processFileBtn.disabled = true; fileInput.disabled = true;
        
        reader.onload = (e) => {
            const fileText = e.target.result; 
            const totalLength = fileText.length; 
            const chunkSize = 50000; 
            let currentIndex = 0; 
            let outputText = '';
            
            progressContainer.classList.remove('d-none'); 
            progressBar.style.width = '0%'; 
            progressPercentage.textContent = '0%'; 
            progressStatusText.textContent = 'Translating...';
            
            // Pass global parameters
            const src = inputLangSelect.value;
            const tgt = outputLangSelect.value;
            
            const processChunk = () => {
                outputText += Transliterator.convert(fileText.substring(currentIndex, currentIndex + chunkSize), src, tgt);
                currentIndex += chunkSize;
                
                const progress = Math.min(100, Math.round((currentIndex / totalLength) * 100));
                progressBar.style.width = `${progress}%`; 
                progressPercentage.textContent = `${progress}%`;
                
                if (currentIndex < totalLength) { setTimeout(processChunk, 0); } else { finalizeDownload(outputText, currentFile.name, tgt); }
            }; processChunk();
        }; reader.readAsText(currentFile);
    });

    const finalizeDownload = (textData, originalFilename, tgtLang) => {
        const ext = `_${tgtLang}.txt`;
        const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob); 
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl; 
        downloadLink.download = originalFilename.replace('.txt', ext);
        document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink); URL.revokeObjectURL(downloadUrl);
        
        progressStatusText.textContent = 'Complete.'; showToast('File processed and downloaded.');
        setTimeout(() => { progressContainer.classList.add('d-none'); fileInput.disabled = false; fileInput.value = ''; currentFile = null; processFileBtn.disabled = true; }, 2500); 
    };

    // OCR Subsystem (OCR strictly parses the defined input language model)
    const handleImageSelection = (file) => {
        ocrProgressContainer.classList.add('d-none');
        if (file && file.type.startsWith('image/')) { currentImage = file; processImageBtn.disabled = false; } 
        else { currentImage = null; processImageBtn.disabled = true; imageInput.value = ''; if (file) showToast('Invalid format. Image required.'); }
    };

    imageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imageDropZone.classList.add('active-drop'); });
    imageDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); imageDropZone.classList.remove('active-drop'); });
    imageDropZone.addEventListener('drop', (e) => { e.preventDefault(); imageDropZone.classList.remove('active-drop'); if (e.dataTransfer.files.length > 0) { imageInput.files = e.dataTransfer.files; handleImageSelection(e.dataTransfer.files[0]); } });
    imageInput.addEventListener('change', (e) => handleImageSelection(e.target.files.length > 0 ? e.target.files[0] : null));

    processImageBtn.addEventListener('click', async () => {
        if (!currentImage) return;
        if (typeof Tesseract === 'undefined') return showToast('Error: OCR Library failed to load.');

        processImageBtn.disabled = true; imageInput.disabled = true;
        ocrProgressContainer.classList.remove('d-none'); ocrProgressBar.style.width = '0%'; ocrPercentage.textContent = '0%'; ocrStatusText.textContent = 'Preparing Engine...';

        // Map UI select to Tesseract training data names
        const tesseractMap = { 'hi': 'hin', 'te': 'tel', 'kn': 'kan', 'ml': 'mal', 'ta': 'tam' };
        const ocrLang = tesseractMap[inputLangSelect.value] || 'tel';

        try {
            const result = await Tesseract.recognize(currentImage, ocrLang, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.min(100, Math.round(m.progress * 100));
                        ocrProgressBar.style.width = `${progress}%`; ocrPercentage.textContent = `${progress}%`; ocrStatusText.textContent = 'Extracting...';
                    } else if (m.status === 'loading language traineddata') {
                        ocrStatusText.textContent = 'Downloading Model...';
                    }
                }
            });

            const extractedText = result.data.text;
            inputElement.value = extractedText;
            autoResize(inputElement);
            dispatchToWorker(extractedText);

            ocrStatusText.textContent = 'Complete.'; showToast('Extraction complete.');

        } catch (error) { showToast('Failed to extract text.'); } 
        finally {
            setTimeout(() => { ocrProgressContainer.classList.add('d-none'); imageInput.disabled = false; imageInput.value = ''; currentImage = null; processImageBtn.disabled = true; }, 3000);
        }
    });

    hydrateState();
});
