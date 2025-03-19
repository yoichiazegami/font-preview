document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const fontNameSelect = document.getElementById('font-name-select');
    const fontNumberSelect = document.getElementById('font-number-select');
    const fontSizeInput = document.getElementById('font-size');
    const letterSpacingInput = document.getElementById('letter-spacing');
    const lineHeightInput = document.getElementById('line-height');
    const sizeValueDisplay = document.getElementById('size-value');
    const letterSpacingValueDisplay = document.getElementById('letter-spacing-value');
    const lineHeightValueDisplay = document.getElementById('line-height-value');
    const previewText = document.getElementById('preview-text');
    const currentFontDisplay = document.getElementById('current-font');
    const currentSizeDisplay = document.getElementById('current-size');
    const currentLetterSpacingDisplay = document.getElementById('current-letter-spacing');
    const currentLineHeightDisplay = document.getElementById('current-line-height');

    // 詳細設定要素
    const advancedSettingsToggle = document.getElementById('advanced-settings-toggle');
    const advancedSettingsPanel = document.getElementById('advanced-settings-panel');
    const writingModeSelect = document.getElementById('writing-mode');
    const textAlignSelect = document.getElementById('text-align');
    const currentWritingModeDisplay = document.getElementById('current-writing-mode');
    const currentTextAlignDisplay = document.getElementById('current-text-align');

    // 初期値の設定
    fontSizeInput.value = 60;
    fontSizeInput.min = 5;
    fontSizeInput.max = 200;
    sizeValueDisplay.textContent = '60px';

    // 字間を相対値（em）で設定
    letterSpacingInput.value = 0;
    letterSpacingInput.min = -0.5;
    letterSpacingInput.max = 1;
    letterSpacingInput.step = 0.01;
    letterSpacingValueDisplay.textContent = '0em';

    lineHeightInput.value = 2;
    lineHeightInput.min = 1;
    lineHeightInput.max = 3;
    lineHeightValueDisplay.textContent = '2';

    // 詳細設定パネルの表示/非表示切り替え
    advancedSettingsToggle.addEventListener('click', () => {
        advancedSettingsPanel.classList.toggle('hidden');
        advancedSettingsToggle.textContent =
            advancedSettingsPanel.classList.contains('hidden') ? '詳細な設定' : '詳細設定を閉じる';
    });

    // スライダー値の表示を更新するイベントリスナー
    fontSizeInput.addEventListener('input', () => {
        sizeValueDisplay.textContent = `${fontSizeInput.value}px`;
        updatePreview();
    });

    letterSpacingInput.addEventListener('input', () => {
        letterSpacingValueDisplay.textContent = `${letterSpacingInput.value}em`;
        updatePreview();
    });

    lineHeightInput.addEventListener('input', () => {
        lineHeightValueDisplay.textContent = lineHeightInput.value;
        updatePreview();
    });

    // 文字方向が変更されたときにテキスト揃えのオプションを更新
    writingModeSelect.addEventListener('change', function () {
        const isVertical = this.value === 'vertical-rl';

        // 既存のオプションを保存
        const currentValue = textAlignSelect.value;

        // テキスト揃えオプションをクリア
        while (textAlignSelect.options.length > 0) {
            textAlignSelect.remove(0);
        }

        // 縦書き/横書きに応じたオプションを追加
        if (isVertical) {
            // 縦書きの場合
            addOption(textAlignSelect, 'left', '上揃え');
            addOption(textAlignSelect, 'center', '中央揃え');
            addOption(textAlignSelect, 'right', '下揃え');
        } else {
            // 横書きの場合
            addOption(textAlignSelect, 'left', '左揃え');
            addOption(textAlignSelect, 'center', '中央揃え');
            addOption(textAlignSelect, 'right', '右揃え');
        }

        // 保存した値を復元（同じ選択位置を維持）
        textAlignSelect.value = currentValue;

        // プレビューを更新
        updatePreview();
    });

    // セレクト要素にオプションを追加するヘルパー関数
    function addOption(selectElement, value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        selectElement.appendChild(option);
    }

    // fontsフォルダ内のフォントファイルを検出する関数
    async function detectFontsInFolder() {
        try {
            // ファイル一覧を取得するためのAPIリクエスト
            const response = await fetch('/api/list-fonts');
            if (!response.ok) {
                throw new Error('フォントファイル一覧の取得に失敗しました');
            }

            const files = await response.json();
            return files.map(file => {
                const name = file.replace(/\.(woff2|woff|ttf|otf)$/, '');
                return {
                    name: name,
                    displayName: file
                };
            });
        } catch (error) {
            console.error('フォント検出エラー:', error);
            // エラー時のフォールバックとして固定リストを使用
            return [
                { name: 'YAMADA_01', displayName: 'YAMADA_01.woff2' },
                { name: 'YAMADA_02', displayName: 'YAMADA_02.woff2' },
                { name: 'SATO_01', displayName: 'SATO_01.woff2' },
                { name: 'SATO_02', displayName: 'SATO_02.woff2' },
                { name: 'font_6', displayName: 'font_6.woff2' },
                { name: 'my_handwritten_font_446737', displayName: 'my_handwritten_font_446737.woff2' },
                { name: 'my_handwritten_font80', displayName: 'my_handwritten_font80.woff2' },
                { name: 'my_handwritten_font76', displayName: 'my_handwritten_font76.woff2' }
            ];
        }
    }

    // @font-face定義を動的に生成する関数
    function createFontFaceDefinitions(fonts) {
        // 既存の定義を削除（動的に追加したものだけ）
        document.querySelectorAll('style.dynamic-font-faces').forEach(style => style.remove());

        // 新しいstyle要素を作成
        const style = document.createElement('style');
        style.className = 'dynamic-font-faces';

        // @font-face定義を生成
        let fontFaceCSS = '';
        fonts.forEach(font => {
            const fontExt = font.displayName.split('.').pop();
            fontFaceCSS += `
@font-face {
    font-family: '${font.name}';
    src: url('fonts/${font.displayName}') format('${fontExt === 'woff2' ? 'woff2' :
                    fontExt === 'woff' ? 'woff' :
                        fontExt === 'ttf' ? 'truetype' :
                            fontExt === 'otf' ? 'opentype' : 'woff2'}');
    font-weight: normal;
    font-style: normal;
}`;
        });

        style.textContent = fontFaceCSS;
        document.head.appendChild(style);
    }

    // フォントファイル一覧を取得して処理を開始
    let fontsInFolder = [];

    detectFontsInFolder().then(fonts => {
        fontsInFolder = fonts;

        // @font-face定義を生成
        createFontFaceDefinitions(fontsInFolder);

        // フォント名・番号オプションを生成
        createFontNameOptions();
        createFontNumberOptions();

        // 初期設定
        if (fontNameSelect.options.length > 0) {
            fontNameSelect.selectedIndex = 0;
            createFontNumberOptions(); // 番号選択リストを初期化
        }
        if (fontNumberSelect.options.length > 0) {
            fontNumberSelect.selectedIndex = 0;
        }

        // テキスト揃えの初期設定
        // 横書きモードのオプションを設定
        addOption(textAlignSelect, 'left', '左揃え');
        addOption(textAlignSelect, 'center', '中央揃え');
        addOption(textAlignSelect, 'right', '右揃え');
        textAlignSelect.value = 'left';

        updatePreview();
    });

    // フォント名と番号を分離する関数
    function parseFontName(fontName) {
        const match = fontName.match(/^(.+?)_(\d+)$/);
        if (match) {
            return {
                name: match[1],
                number: match[2]
            };
        }
        return null;
    }

    // フォント名オプションを生成
    function createFontNameOptions() {
        // 既存のオプションをクリア
        while (fontNameSelect.options.length > 0) {
            fontNameSelect.remove(0);
        }

        const fontNames = new Set();

        // フォント名を収集
        fontsInFolder.forEach(font => {
            const parsed = parseFontName(font.name);
            if (parsed) {
                fontNames.add(parsed.name);
            }
        });

        // オプションを生成（アルファベット順でソート）
        Array.from(fontNames).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            fontNameSelect.appendChild(option);
        });

        console.log("フォント名オプション生成完了");
    }

    // フォント番号オプションを生成
    function createFontNumberOptions() {
        // 既存のオプションをクリア
        while (fontNumberSelect.options.length > 0) {
            fontNumberSelect.remove(0);
        }

        const selectedName = fontNameSelect.value;
        console.log("選択されたフォント名:", selectedName);

        // 選択されたフォント名がない場合は番号選択を無効化
        if (!selectedName) {
            fontNumberSelect.disabled = true;
            return;
        }

        fontNumberSelect.disabled = false;

        // 選択された名前に対応する番号を収集
        const numbers = new Set();
        fontsInFolder.forEach(font => {
            const parsed = parseFontName(font.name);
            if (parsed && parsed.name === selectedName) {
                numbers.add(parsed.number);
                console.log("フォント番号を追加:", parsed.number);
            }
        });

        // 番号を数値としてソートして追加
        Array.from(numbers)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(number => {
                const option = document.createElement('option');
                option.value = number;
                option.textContent = number;
                fontNumberSelect.appendChild(option);
            });

        console.log("フォント番号オプション生成完了:", Array.from(numbers));
    }

    // イベントリスナーの設定
    fontNameSelect.addEventListener('change', () => {
        console.log("フォント名が変更されました:", fontNameSelect.value);
        createFontNumberOptions();
        updatePreview();
    });
    fontNumberSelect.addEventListener('change', updatePreview);
    fontSizeInput.addEventListener('input', updatePreview);
    letterSpacingInput.addEventListener('input', updatePreview);
    lineHeightInput.addEventListener('input', updatePreview);
    writingModeSelect.addEventListener('change', updatePreview);
    textAlignSelect.addEventListener('change', updatePreview);

    // プレビューの更新関数
    function updatePreview() {
        const selectedName = fontNameSelect.value;
        const selectedNumber = fontNumberSelect.value;
        const selectedSize = fontSizeInput.value;
        const selectedLetterSpacing = letterSpacingInput.value;
        const selectedLineHeight = lineHeightInput.value;
        const selectedWritingMode = writingModeSelect.value;
        const selectedTextAlign = textAlignSelect.value;

        console.log("プレビュー更新:", selectedName, selectedNumber);

        // フォント名の設定
        let fontFamily;

        if (selectedName && selectedNumber) {
            // フルネームの生成
            const fullFontName = `${selectedName}_${selectedNumber}`;
            fontFamily = `"${fullFontName}"`;
            console.log("カスタムフォント使用:", fullFontName);
        } else {
            fontFamily = 'sans-serif';
        }

        // 縦書きクラスとテキスト揃えクラスの切り替え
        // 一旦すべてのクラスを削除
        previewText.classList.remove('vertical-writing', 'vertical-align-top', 'vertical-align-center', 'vertical-align-bottom');

        if (selectedWritingMode === 'vertical-rl') {
            // 縦書きの場合
            previewText.classList.add('vertical-writing');

            // 縦書きでのテキスト揃え（左→上、中央→中央、右→下）
            if (selectedTextAlign === 'left') {
                previewText.classList.add('vertical-align-top');
                previewText.style.textAlign = 'start';
            } else if (selectedTextAlign === 'center') {
                previewText.classList.add('vertical-align-center');
                previewText.style.textAlign = 'center';
            } else if (selectedTextAlign === 'right') {
                previewText.classList.add('vertical-align-bottom');
                previewText.style.textAlign = 'end';
            }

            // 表示名の変換
            currentTextAlignDisplay.textContent =
                selectedTextAlign === 'left' ? '上揃え' :
                    selectedTextAlign === 'center' ? '中央揃え' : '下揃え';
        } else {
            // 横書きの場合は通常のテキスト揃え
            previewText.style.textAlign = selectedTextAlign;

            // 表示名
            currentTextAlignDisplay.textContent =
                selectedTextAlign === 'left' ? '左揃え' :
                    selectedTextAlign === 'center' ? '中央揃え' : '右揃え';
        }

        // プレビューテキストのスタイル更新
        previewText.style.fontFamily = fontFamily;
        previewText.style.fontSize = `${selectedSize}px`;
        previewText.style.letterSpacing = `${selectedLetterSpacing}em`;
        previewText.style.lineHeight = selectedLineHeight;

        // 情報表示の更新
        currentFontDisplay.textContent = (selectedName && selectedNumber) ?
            `${selectedName}_${selectedNumber}` : 'デフォルト';
        currentSizeDisplay.textContent = `${selectedSize}px`;
        currentLetterSpacingDisplay.textContent = `${selectedLetterSpacing}em`;
        currentLineHeightDisplay.textContent = selectedLineHeight;

        // 詳細設定の表示更新（文字方向）
        currentWritingModeDisplay.textContent = selectedWritingMode === 'horizontal-tb' ? '横書き' : '縦書き';
    }
}); 