document.addEventListener('DOMContentLoaded', () => {
    // Standard UI Elements
    const inputElement = document.getElementById('teluguInput');
    const outputElement = document.getElementById('devanagariOutput');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const printBtn = document.getElementById('printBtn');
    
    // Core Logic Elements
    const inputWordCount = document.getElementById('inputWordCount');
    const inputCharCount = document.getElementById('inputCharCount');
    const outputWordCount = document.getElementById('outputWordCount');
    const outputCharCount = document.getElementById('outputCharCount');
    const editorFontSizeSlider = document.getElementById('editorFontSize');
    const printFontSizeSlider = document.getElementById('printFontSize');
    const editorFontValue = document.getElementById('editorFontValue');
    const printFontValue = document.getElementById('printFontValue');

    // Subsystem: Text File I/O
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const processFileBtn = document.getElementById('processFileBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStatusText = document.getElementById('progressStatusText');

    // Subsystem: Image OCR I/O
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
    const PRINT_CHAR_LIMIT = 50000;

    // -------------------------------------------------------------
    // Dynamic Web Worker Construction
    // -------------------------------------------------------------
    const workerScript = `
        ${Transliterator.toString()}
        self.onmessage = function(e) { self.postMessage(Transliterator.convert(e.data)); };
    `;
    const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
    const transliterationWorker = new Worker(URL.createObjectURL(workerBlob));

    let isWorkerBusy = false;
    let pendingText = null;

    transliterationWorker.onmessage = (e) => {
        outputElement.value = e.data;
        updateCounters(e.data, outputWordCount, outputCharCount);
        isWorkerBusy = false;
        if (pendingText !== null) {
            const textToProcess = pendingText;
            pendingText = null;
            isWorkerBusy = true;
            transliterationWorker.postMessage(textToProcess);
        }
    };

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

    const showToast = (message) => {
        document.getElementById('toastMessage').textContent = message;
        toast.show();
    };

    const applyConfiguration = (editorSize, printSize) => {
        document.documentElement.style.setProperty('--editor-font-size', `${editorSize}rem`);
        document.documentElement.style.setProperty('--print-font-size', `${printSize}pt`);
        editorFontValue.textContent = `${editorSize}rem`;
        printFontValue.textContent = `${printSize}pt`;
        editorFontSizeSlider.value = editorSize;
        printFontSizeSlider.value = printSize;
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
    const dispatchToWorker = (teluguText) => {
        updateCounters(teluguText, inputWordCount, inputCharCount);
        localStorage.setItem(STORAGE_KEY_TEXT, teluguText);
        if (isWorkerBusy) { pendingText = teluguText; } else { isWorkerBusy = true; transliterationWorker.postMessage(teluguText); }
    };

    const debouncedDispatch = debounce((text) => { dispatchToWorker(text); }, 200);

    inputElement.addEventListener('input', (event) => debouncedDispatch(event.target.value));

    const hydrateState = () => {
        const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG));
        if (savedConfig) applyConfiguration(savedConfig.editorSize, savedConfig.printSize);
        const savedText = localStorage.getItem(STORAGE_KEY_TEXT);
        if (savedText) { inputElement.value = savedText; dispatchToWorker(savedText); }
    };

    // -------------------------------------------------------------
    // Toolbar Logic
    // -------------------------------------------------------------
    copyBtn.addEventListener('click', async () => {
        if (!outputElement.value) return showToast('Nothing to copy.');
        try { await navigator.clipboard.writeText(outputElement.value); showToast('Devanagari text copied.'); } 
        catch (err) { showToast('Failed to copy text.'); }
    });

    clearBtn.addEventListener('click', () => {
        inputElement.value = ''; outputElement.value = ''; fileInput.value = ''; imageInput.value = '';
        currentFile = null; currentImage = null; pendingText = null;
        processFileBtn.disabled = true; processImageBtn.disabled = true;
        progressContainer.classList.add('d-none'); ocrProgressContainer.classList.add('d-none');
        updateCounters('', inputWordCount, inputCharCount); updateCounters('', outputWordCount, outputCharCount);
        localStorage.removeItem(STORAGE_KEY_TEXT);
        inputElement.focus();
        showToast('Workspace cleared.');
    });

    printBtn.addEventListener('click', () => {
        const printContent = outputElement.value;
        if (!printContent) return showToast('No output to print.');
        if (printContent.length > PRINT_CHAR_LIMIT) return showToast(`Data exceeds print limit (${PRINT_CHAR_LIMIT} chars). Please use Bulk File Processing.`);
        const printSize = document.documentElement.style.getPropertyValue('--print-font-size') || '14pt';
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none'; document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document; doc.open();
        doc.write(`<!DOCTYPE html><html><head><style>@page { margin: 2cm; } body { font-family: sans-serif; font-size: ${printSize}; white-space: pre-wrap; word-wrap: break-word; color: #000; background: #fff; margin: 0; padding: 0; }</style></head><body>${printContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`);
        doc.close(); iframe.contentWindow.focus(); iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    });

    // -------------------------------------------------------------
    // Image OCR Subsystem
    // -------------------------------------------------------------
    const handleImageSelection = (file) => {
        ocrProgressContainer.classList.add('d-none');
        if (file && file.type.startsWith('image/')) {
            currentImage = file;
            processImageBtn.disabled = false;
        } else {
            currentImage = null;
            processImageBtn.disabled = true;
            imageInput.value = '';
            if (file) showToast('Invalid format. Image (.jpg, .png) required.');
        }
    };

    imageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imageDropZone.classList.add('active-drop'); });
    imageDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); imageDropZone.classList.remove('active-drop'); });
    imageDropZone.addEventListener('drop', (e) => {
        e.preventDefault(); imageDropZone.classList.remove('active-drop');
        if (e.dataTransfer.files.length > 0) {
            imageInput.files = e.dataTransfer.files; 
            handleImageSelection(e.dataTransfer.files[0]);
        }
    });
    imageInput.addEventListener('change', (e) => handleImageSelection(e.target.files.length > 0 ? e.target.files[0] : null));

    processImageBtn.addEventListener('click', async () => {
        if (!currentImage) return;
        if (typeof Tesseract === 'undefined') return showToast('Error: OCR Library failed to load. Check internet connection.');

        processImageBtn.disabled = true;
        imageInput.disabled = true;
        ocrProgressContainer.classList.remove('d-none');
        ocrProgressBar.style.width = '0%';
        ocrPercentage.textContent = '0%';
        ocrStatusText.textContent = 'Preparing Optical Engine...';

        try {
            const result = await Tesseract.recognize(currentImage, 'tel', {
                logger: m => {
                    // Tesseract reports detailed initialization states.
                    // We map the main text recognition phase to the progress bar.
                    if (m.status === 'recognizing text') {
                        const progress = Math.min(100, Math.round(m.progress * 100));
                        ocrProgressBar.style.width = `${progress}%`;
                        ocrPercentage.textContent = `${progress}%`;
                        ocrStatusText.textContent = 'Extracting script from image...';
                    } else if (m.status === 'loading tesseract core') {
                        ocrStatusText.textContent = 'Loading core engine...';
                    } else if (m.status === 'loading language traineddata') {
                        ocrStatusText.textContent = 'Downloading Telugu Language Model...';
                    }
                }
            });

            const extractedText = result.data.text;

            // Route output into the main editor for user validation
            inputElement.value = extractedText;
            dispatchToWorker(extractedText);

            ocrStatusText.textContent = 'Complete.';
            showToast('Image extraction complete. Please verify accuracy.');

        } catch (error) {
            console.error('OCR Error:', error);
            showToast('Failed to extract text. Ensure image is clear and internet is connected.');
        } finally {
            setTimeout(() => {
                ocrProgressContainer.classList.add('d-none');
                imageInput.disabled = false;
                imageInput.value = '';
                currentImage = null;
                processImageBtn.disabled = true;
            }, 3000);
        }
    });

    // -------------------------------------------------------------
    // Text File Bulk Subsystem (Intact)
    // -------------------------------------------------------------
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
            const teluguText = e.target.result; const totalLength = teluguText.length; const chunkSize = 50000; 
            let currentIndex = 0; let devanagariText = '';
            progressContainer.classList.remove('d-none'); progressBar.style.width = '0%'; progressPercentage.textContent = '0%'; progressStatusText.textContent = 'Translating...';
            const processChunk = () => {
                devanagariText += Transliterator.convert(teluguText.substring(currentIndex, currentIndex + chunkSize));
                currentIndex += chunkSize;
                const progress = Math.min(100, Math.round((currentIndex / totalLength) * 100));
                progressBar.style.width = `${progress}%`; progressPercentage.textContent = `${progress}%`;
                if (currentIndex < totalLength) { setTimeout(processChunk, 0); } else { finalizeDownload(devanagariText, currentFile.name); }
            }; processChunk();
        }; reader.readAsText(currentFile);
    });

    const finalizeDownload = (textData, originalFilename) => {
        const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob); const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl; downloadLink.download = originalFilename.replace('.txt', '_devanagari.txt');
        document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink); URL.revokeObjectURL(downloadUrl);
        progressStatusText.textContent = 'Complete.'; showToast('File processed and downloaded.');
        setTimeout(() => { progressContainer.classList.add('d-none'); fileInput.disabled = false; fileInput.value = ''; currentFile = null; processFileBtn.disabled = true; }, 2500); 
    };

    hydrateState();
});
