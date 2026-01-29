import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import './TranslatePdfView.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const LANGUAGES = [
    { key: 'en', label: 'English' },
    { key: 'sv', label: 'Svenska' },
    { key: 'de', label: 'Deutsch' },
    { key: 'fr', label: 'Français' },
    { key: 'es', label: 'Español' },
    { key: 'da', label: 'Dansk' },
    { key: 'no', label: 'Norsk' },
    { key: 'fi', label: 'Suomi' },
];

export default function TranslatePdfView({ pdfBuffer, fileName, targetLang, onClose }) {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        console.log('TranslatePdfView: MOUNTED', {
            fileName,
            targetLang,
            bufferSize: pdfBuffer?.length,
            isBuffer: pdfBuffer instanceof Uint8Array
        });
    }, []);

    const canvasRef = useRef(null);
    const pdfDocRef = useRef(null);

    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);

    // Use prop as initial value, internal state tracks selection
    const [currentLang, setCurrentLang] = useState(targetLang || 'sv');

    const [pageText, setPageText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [translateError, setTranslateError] = useState('');

    // Translation mode: 'summary' | 'full' | null (null = not selected yet)
    const [translationMode, setTranslationMode] = useState(null);

    const [chatInput, setChatInput] = useState('');
    const [chatResponse, setChatResponse] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    const translateServerUrl = import.meta.env.VITE_TRANSLATE_SERVER_URL || 'http://localhost:8082';

    // Load PDF document
    useEffect(() => {
        console.log('TranslatePdfView: useEffect triggered', {
            hasBuffer: !!pdfBuffer,
            bufferLength: pdfBuffer?.length,
            bufferType: pdfBuffer?.constructor?.name
        });

        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.log('TranslatePdfView: No buffer, skipping load');
            return;
        }

        const loadPdf = async () => {
            try {
                console.log('TranslatePdfView: Starting PDF load...');
                // Clone the buffer to prevent "detached ArrayBuffer" errors
                const bufferCopy = pdfBuffer.slice(0);
                console.log('TranslatePdfView: Buffer cloned, length:', bufferCopy.length);

                const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
                console.log('TranslatePdfView: getDocument called');

                const pdf = await loadingTask.promise;
                console.log('TranslatePdfView: PDF loaded, numPages:', pdf.numPages);

                pdfDocRef.current = pdf;
                setNumPages(pdf.numPages);
                setCurrentPage(1);
            } catch (err) {
                console.error('TranslatePdfView: Failed to load PDF:', err);
            }
        };

        loadPdf();
    }, [pdfBuffer]);

    // Render current page
    useEffect(() => {
        console.log('TranslatePdfView: Render useEffect', {
            hasPdfDoc: !!pdfDocRef.current,
            hasCanvas: !!canvasRef.current,
            currentPage,
            numPages
        });

        if (!pdfDocRef.current || !canvasRef.current) {
            console.log('TranslatePdfView: Skipping render - missing refs');
            return;
        }

        const renderPage = async () => {
            try {
                console.log('TranslatePdfView: Rendering page', currentPage);
                const page = await pdfDocRef.current.getPage(currentPage);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                canvas.height = viewport.height;
                canvas.width = viewport.width;
                console.log('TranslatePdfView: Canvas size set', { w: canvas.width, h: canvas.height });

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                }).promise;
                console.log('TranslatePdfView: Page rendered successfully');

                // Extract text from page
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                setPageText(text);
                console.log('TranslatePdfView: Text extracted, length:', text.length);
            } catch (err) {
                console.error('TranslatePdfView: Failed to render page:', err);
            }
        };

        renderPage();
    }, [currentPage, scale, numPages]);

    // Translate when page text, language, or mode changes
    useEffect(() => {
        if (!pageText.trim() || !translationMode) {
            setTranslatedText('');
            return;
        }

        const translateText = async () => {
            setIsTranslating(true);
            setTranslateError('');
            setTranslatedText('');

            try {
                const resp = await fetch(`${translateServerUrl}/translate-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: pageText,
                        targetLang: currentLang,
                        mode: translationMode // 'summary' or 'full'
                    }),
                });

                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(errText || 'Translation failed');
                }

                const data = await resp.json();
                setTranslatedText(data.translatedText || '');
            } catch (err) {
                setTranslateError(err.message || 'Translation failed');
            } finally {
                setIsTranslating(false);
            }
        };

        const debounce = setTimeout(translateText, 500);
        return () => clearTimeout(debounce);
    }, [pageText, currentLang, translateServerUrl, translationMode]);

    const handlePrevPage = useCallback(() => {
        setCurrentPage(p => Math.max(1, p - 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage(p => Math.min(numPages, p + 1));
    }, [numPages]);

    const handleZoomIn = useCallback(() => {
        setScale(s => Math.min(3, s + 0.2));
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale(s => Math.max(0.5, s - 0.2));
    }, []);

    const handleChat = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        setIsChatLoading(true);
        setChatResponse('');

        try {
            const resp = await fetch(`${translateServerUrl}/chat-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: pageText,
                    question: chatInput,
                    targetLang: currentLang
                }),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(errText || 'Chat failed');
            }

            const data = await resp.json();
            setChatResponse(data.response || 'No response');
        } catch (err) {
            setChatResponse(`Error: ${err.message}`);
        } finally {
            setIsChatLoading(false);
            setChatInput('');
        }
    };

    const handleDownload = () => {
        if (!translatedText) return;

        const blob = new Blob([translatedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.replace(/\.[^.]+$/, '')}_translated.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="translateView">
            {/* Header */}
            <header className="translateViewHeader">
                <button className="translateBackBtn" onClick={onClose}>
                    ← {t('common.back', 'Back')}
                </button>
                <h1>
                    📄 {t('landingPage.nav.translatePdf', 'Translate PDF')}
                </h1>
                <button
                    className="translateDownloadBtn"
                    onClick={handleDownload}
                    disabled={!translatedText}
                >
                    {t('toolbar.download', 'Download')}
                </button>
            </header>

            {/* Main Content */}
            <div className="translateViewContent">
                {/* Left Panel - PDF Viewer */}
                <div className="translatePdfPanel">
                    <div className="translatePdfViewer">
                        <canvas ref={canvasRef} />
                    </div>
                    <div className="translatePdfControls">
                        <button onClick={handlePrevPage} disabled={currentPage <= 1}>
                            ◀
                        </button>
                        <span>{currentPage} / {numPages}</span>
                        <button onClick={handleNextPage} disabled={currentPage >= numPages}>
                            ▶
                        </button>
                        <button onClick={handleZoomOut} disabled={scale <= 0.5}>
                            🔍−
                        </button>
                        <button onClick={handleZoomIn} disabled={scale >= 3}>
                            🔍+
                        </button>
                    </div>
                </div>

                {/* Right Panel - Translation */}
                <div className="translateResultPanel">
                    <div className="translateResultHeader">
                        <h2>📝 {t('tools.translate.targetLanguage', 'Target language')}</h2>
                        <select
                            className="translateLangSelect"
                            value={currentLang}
                            onChange={(e) => setCurrentLang(e.target.value)}
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="translateResultContent">
                        {/* Mode Selection - shown when no mode is selected */}
                        {!translationMode && !isTranslating && (
                            <div className="translateModeSelection">
                                <h3>{t('translate.chooseMode', 'Choose translation mode')}</h3>
                                <div className="translateModeButtons">
                                    <button
                                        className="translateModeBtn translateModeSummary"
                                        onClick={() => setTranslationMode('summary')}
                                    >
                                        <span className="modeIcon">📋</span>
                                        <span className="modeTitle">{t('translate.summarize', 'Summarize')}</span>
                                        <span className="modeDesc">{t('translate.summarizeDesc', 'Extract key information')}</span>
                                    </button>
                                    <button
                                        className="translateModeBtn translateModeFull"
                                        onClick={() => setTranslationMode('full')}
                                    >
                                        <span className="modeIcon">📄</span>
                                        <span className="modeTitle">{t('translate.translateFull', 'Translate Full')}</span>
                                        <span className="modeDesc">{t('translate.translateFullDesc', 'Translate entire document')}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Loading state */}
                        {isTranslating && (
                            <div className="translateLoading">
                                <div className="translateSpinner" />
                                <span>{t('loading.processing', 'Processing...')}</span>
                            </div>
                        )}

                        {/* Error state */}
                        {translateError && !isTranslating && (
                            <div className="translateError">{translateError}</div>
                        )}

                        {/* Results - different formatting based on mode */}
                        {translatedText && !isTranslating && (
                            <div className={`translateText ${translationMode === 'summary' ? 'summaryFormat' : 'fullFormat'}`}>
                                {/* Mode indicator and reset button */}
                                <div className="translateModeIndicator">
                                    <span>{translationMode === 'summary' ? '📋 ' + t('translate.summary', 'Summary') : '📄 ' + t('translate.fullTranslation', 'Full Translation')}</span>
                                    <button
                                        className="translateModeReset"
                                        onClick={() => {
                                            setTranslationMode(null);
                                            setTranslatedText('');
                                        }}
                                    >
                                        {t('translate.changeMode', 'Change mode')}
                                    </button>
                                </div>

                                {/* Formatted content */}
                                <div className="translateContent">
                                    {translatedText.split('\n').map((line, i) => {
                                        // Skip empty lines but keep spacing
                                        if (!line.trim()) return <br key={i} />;

                                        // Parse **bold** text
                                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                                        return (
                                            <p key={i}>
                                                {parts.map((part, j) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                })}
                                            </p>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Initial hint when mode selected but no text yet */}
                        {translationMode && !translatedText && !isTranslating && !translateError && (
                            <div style={{ color: '#999', textAlign: 'center', paddingTop: 40 }}>
                                {t('translate.waitingForText', 'Extracting text from PDF...')}
                            </div>
                        )}
                    </div>

                    {/* Chat Section */}
                    <div className="translateChatSection">
                        <div className="translateChatLabel">
                            💬 {t('translate.askAboutPdf', 'Ask about this PDF')}
                        </div>

                        {/* Suggested Questions */}
                        <div className="translateSuggestedQuestions">
                            {[
                                t('translate.suggestion1', 'What is this document about?'),
                                t('translate.suggestion2', 'Summarize the key points'),
                                t('translate.suggestion3', 'What are the important dates?'),
                                t('translate.suggestion4', 'What amounts are mentioned?')
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    className="translateSuggestionChip"
                                    onClick={() => {
                                        setChatInput(suggestion);
                                    }}
                                    disabled={isChatLoading}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        <div className="translateChatInput">
                            <input
                                type="text"
                                placeholder={t('translate.chatPlaceholder', 'Ask a question...')}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                                disabled={isChatLoading}
                            />
                            <button
                                onClick={handleChat}
                                disabled={isChatLoading || !chatInput.trim()}
                                className={isChatLoading ? 'loading' : ''}
                            >
                                {isChatLoading ? (
                                    <span className="chatSpinner" />
                                ) : '→'}
                            </button>
                        </div>
                        {chatResponse && (
                            <div className="translateChatResponse">
                                {chatResponse}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
