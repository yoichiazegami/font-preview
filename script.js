document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const fontSelect = document.getElementById('font-select');
    const fontSizeInput = document.getElementById('font-size');
    const fontWeightSelect = document.getElementById('font-weight');
    const letterSpacingInput = document.getElementById('letter-spacing');
    const lineHeightInput = document.getElementById('line-height');
    const sizeValueDisplay = document.getElementById('size-value');
    const letterSpacingValueDisplay = document.getElementById('letter-spacing-value');
    const lineHeightValueDisplay = document.getElementById('line-height-value');
    const previewText = document.getElementById('preview-text');
    const currentFontDisplay = document.getElementById('current-font');
    const currentSizeDisplay = document.getElementById('current-size');
    const currentWeightDisplay = document.getElementById('current-weight');
    const currentLetterSpacingDisplay = document.getElementById('current-letter-spacing');
    const currentLineHeightDisplay = document.getElementById('current-line-height');

    // フォントフォルダ内のフォントを自動検出（サーバー環境が必要）
    // この機能はサーバー上で実行する必要があります
    // ローカルファイルシステムでは動作しない場合があります

    // 初期設定
    // 最初のオプションを選択（手書きフォント）
    fontSelect.selectedIndex = 0;
    updatePreview();

    // イベントリスナーの設定
    fontSelect.addEventListener('change', updatePreview);
    fontSizeInput.addEventListener('input', updatePreview);
    fontWeightSelect.addEventListener('change', updatePreview);
    letterSpacingInput.addEventListener('input', updatePreview);
    lineHeightInput.addEventListener('input', updatePreview);

    // プレビューの更新関数
    function updatePreview() {
        const selectedFont = fontSelect.value;
        const selectedSize = fontSizeInput.value;
        const selectedWeight = fontWeightSelect.value;
        const selectedLetterSpacing = letterSpacingInput.value;
        const selectedLineHeight = lineHeightInput.value;

        // プレビューテキストのスタイル更新
        previewText.style.fontFamily = selectedFont;
        previewText.style.fontSize = `${selectedSize}px`;
        previewText.style.fontWeight = selectedWeight;
        previewText.style.letterSpacing = `${selectedLetterSpacing}px`;
        previewText.style.lineHeight = selectedLineHeight;

        // 情報表示の更新
        currentFontDisplay.textContent = selectedFont;
        currentSizeDisplay.textContent = `${selectedSize}px`;
        currentWeightDisplay.textContent = selectedWeight === 'normal' ? '標準' : '太字';
        currentLetterSpacingDisplay.textContent = `${selectedLetterSpacing}px`;
        currentLineHeightDisplay.textContent = selectedLineHeight;
        sizeValueDisplay.textContent = `${selectedSize}px`;
        letterSpacingValueDisplay.textContent = `${selectedLetterSpacing}px`;
        lineHeightValueDisplay.textContent = selectedLineHeight;
    }

    // ローカルフォントの検出（実験的機能）
    if (window.queryLocalFonts) {
        const detectLocalFontsBtn = document.createElement('button');
        detectLocalFontsBtn.textContent = 'ローカルフォントを検出';
        detectLocalFontsBtn.id = 'detect-local-fonts';
        document.querySelector('.container').appendChild(detectLocalFontsBtn);

        detectLocalFontsBtn.addEventListener('click', async () => {
            try {
                const availableFonts = await window.queryLocalFonts();

                // 重複を避けるために既存のフォントを取得
                const existingFonts = Array.from(fontSelect.options).map(option => option.value);

                // 新しいフォントを追加
                availableFonts.forEach(fontData => {
                    const fontName = fontData.family;
                    if (!existingFonts.includes(fontName)) {
                        const option = document.createElement('option');
                        option.value = fontName;
                        option.textContent = fontName;
                        fontSelect.appendChild(option);
                        existingFonts.push(fontName);
                    }
                });

                alert(`${availableFonts.length}個のローカルフォントが検出されました。重複を除いて追加しました。`);
            } catch (error) {
                alert('ローカルフォントの検出に失敗しました: ' + error.message);
            }
        });
    }
}); 