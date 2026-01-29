import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument } from 'pdf-lib';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'images';
    return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function JpgToPdfTool({ onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [images, setImages] = useState([]); // Array of { name, dataUrl, width, height }
    const [filename, setFilename] = useState('images');
    const [pageSize, setPageSize] = useState('fit'); // 'a4', 'letter', 'fit'
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const onPick = async (files) => {
        if (!files || files.length === 0) return;
        setErrMsg('');
        setSuccessMsg('');

        const newImages = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // Get image dimensions
                const dims = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.width, height: img.height });
                    img.onerror = () => resolve({ width: 800, height: 600 });
                    img.src = dataUrl;
                });

                newImages.push({
                    name: file.name,
                    dataUrl,
                    width: dims.width,
                    height: dims.height
                });
            } catch (e) {
                console.warn('Could not load image:', file.name, e);
            }
        }

        if (newImages.length > 0) {
            setImages((prev) => [...prev, ...newImages]);
            if (filename === 'images' && newImages[0]?.name) {
                const stem = newImages[0].name.replace(/\.[^.]+$/, '');
                setFilename(stem);
            }
        }
    };

    const removeImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const moveImage = (index, direction) => {
        setImages((prev) => {
            const newArr = [...prev];
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= newArr.length) return prev;
            [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
            return newArr;
        });
    };

    const canRun = images.length > 0 && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);

        try {
            const pdfDoc = await PDFDocument.create();

            for (const img of images) {
                let embeddedImage;
                if (img.dataUrl.includes('image/png')) {
                    const pngBytes = await fetch(img.dataUrl).then((r) => r.arrayBuffer());
                    embeddedImage = await pdfDoc.embedPng(pngBytes);
                } else {
                    // Treat as JPEG
                    const jpgBytes = await fetch(img.dataUrl).then((r) => r.arrayBuffer());
                    embeddedImage = await pdfDoc.embedJpg(jpgBytes);
                }

                let pageWidth, pageHeight;
                if (pageSize === 'a4') {
                    pageWidth = 595.28;
                    pageHeight = 841.89;
                } else if (pageSize === 'letter') {
                    pageWidth = 612;
                    pageHeight = 792;
                } else {
                    // fit - use image dimensions
                    pageWidth = img.width;
                    pageHeight = img.height;
                }

                const page = pdfDoc.addPage([pageWidth, pageHeight]);

                // Scale image to fit page
                const imgWidth = embeddedImage.width;
                const imgHeight = embeddedImage.height;
                const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
                const drawWidth = imgWidth * scale;
                const drawHeight = imgHeight * scale;
                const x = (pageWidth - drawWidth) / 2;
                const y = (pageHeight - drawHeight) / 2;

                page.drawImage(embeddedImage, {
                    x,
                    y,
                    width: drawWidth,
                    height: drawHeight
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.convert.success', 'Conversion successful!'));
        } catch (e) {
            setErrMsg((e && e.message) || t('tools.convert.error', 'Conversion failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.jpgToPdf', 'JPG to PDF')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            background: '#fff',
                            cursor: 'pointer',
                            fontWeight: 650
                        }}
                    >
                        {t('landingPage.chooseFile', 'Choose file')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setImages([]); setSuccessMsg(''); setErrMsg(''); }}
                        disabled={images.length === 0 || isRunning}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            background: images.length === 0 || isRunning ? '#f3f3f3' : '#fff',
                            cursor: images.length === 0 || isRunning ? 'not-allowed' : 'pointer',
                            fontWeight: 650,
                            opacity: images.length === 0 || isRunning ? 0.6 : 1
                        }}
                    >
                        {t('common.clear', 'Clear')}
                    </button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                    onPick(Array.from(e.target.files || []));
                    e.target.value = '';
                }}
            />

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>
                    {t('tools.input', 'Input')}
                </div>
                {images.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {images.map((img, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                                <img src={img.dataUrl} alt={img.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {img.name}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                                    <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: idx === images.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === images.length - 1 ? 0.4 : 1 }}>↓</button>
                                    <button type="button" onClick={() => removeImage(idx)} style={{ padding: '4px 8px', border: '1px solid #fdd', borderRadius: 6, background: '#fff', color: '#c00', cursor: 'pointer' }}>×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: '#666' }}>{t('tools.convert.jpgHint', 'Select one or more images (JPG, PNG) to convert to PDF.')}</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
                    {t('tools.convert.pageSize', 'Page size')}
                </label>
                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
                >
                    <option value="fit">{t('tools.convert.fitToImage', 'Fit to image')}</option>
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                </select>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
                    {t('downloadModal.filename', 'Filename')}
                </label>
                <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="images"
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #ddd',
                        fontSize: 14
                    }}
                />
            </div>

            {errMsg && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
                    {errMsg}
                </div>
            )}

            {successMsg && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>
                    {successMsg}
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #ddd',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 650
                    }}
                >
                    {t('downloadModal.cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={run}
                    disabled={!canRun}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: canRun ? '#F4D35E' : '#bbb',
                        color: canRun ? '#333' : '#fff',
                        cursor: canRun ? 'pointer' : 'not-allowed',
                        fontWeight: 800,
                        opacity: canRun ? 1 : 0.7
                    }}
                >
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.convert.run', 'Convert')}
                </button>
            </div>
        </div>
    );
}
