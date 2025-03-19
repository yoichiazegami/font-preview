document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const fontNameSelect = document.getElementById('font-name-select');
    const fontNumberSelect = document.getElementById('font-number-select');
    const fontSizeInput = document.getElementById('font-size');
    const letterSpacingInput = document.getElementById('letter-spacing');
    const lineHeightInput = document.getElementById('line-height');
    const useNormalFontCheckbox = document.getElementById('use-normal-font');
    const sizeValueDisplay = document.getElementById('size-value');
    const letterSpacingValueDisplay = document.getElementById('letter-spacing-value');
    const lineHeightValueDisplay = document.getElementById('line-height-value');
    const previewText = document.getElementById('preview-text');
    const currentFontDisplay = document.getElementById('current-font');
    const currentSizeDisplay = document.getElementById('current-size');
    const currentLetterSpacingDisplay = document.getElementById('current-letter-spacing');
    const currentLineHeightDisplay = document.getElementById('current-line-height');

    // フォントリスト更新ボタン
    const refreshFontsButton = document.getElementById('refresh-fonts');

    // 文字方向と文字揃え要素
    const writingModeSelect = document.getElementById('writing-mode');
    const textAlignSelect = document.getElementById('text-align');
    const currentWritingModeDisplay = document.getElementById('current-writing-mode');
    const currentTextAlignDisplay = document.getElementById('current-text-align');

    // IndexedDBの設定
    const DB_NAME = 'fontsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'fonts';
    let db;

    // 初期化処理を非同期で実行
    async function initialize() {
        try {
            // IndexedDBを初期化
            await initIndexedDB();

            // Githubリポジトリからフォントをロード
            await loadFontsFromRepository();

            // フォントオプションを生成
            createFontNameOptions();
            createFontNumberOptions();

            // 初期設定
            if (fontNameSelect.options.length > 0) {
                fontNameSelect.selectedIndex = 0;
                createFontNumberOptions();
            }
            if (fontNumberSelect.options.length > 0) {
                fontNumberSelect.selectedIndex = 0;
            }

            // テキスト揃えの初期設定
            addOption(textAlignSelect, 'left', '左揃え');
            addOption(textAlignSelect, 'center', '中央揃え');
            addOption(textAlignSelect, 'right', '右揃え');
            textAlignSelect.value = 'left';

            // プレビューを更新
            updatePreview();

            console.log('初期化完了');
        } catch (error) {
            console.error('初期化エラー:', error);
        }
    }

    // 初期化を実行
    initialize();

    // IndexedDBを初期化
    function initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject('IndexedDBが使用できません。ブラウザの設定を確認してください。');
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('IndexedDB接続成功');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'name' });
                    console.log('フォント保存用のObjectStore作成完了');
                }
            };
        });
    }

    // フォントリスト更新ボタンの処理強化
    refreshFontsButton.addEventListener('click', async () => {
        try {
            refreshFontsButton.disabled = true;
            refreshFontsButton.textContent = '更新中...';

            console.log('フォントリスト更新開始');

            // GitHub経由で最新のフォントを取得
            const repoFonts = await loadFontsFromRepository();

            if (repoFonts && repoFonts.length > 0) {
                console.log(`${repoFonts.length}個のフォントを取得しました`);
                refreshFontsButton.textContent = `${repoFonts.length}個のフォントを更新しました`;
            } else {
                console.log('新しいフォントはありませんでした');
                refreshFontsButton.textContent = 'フォントが見つかりませんでした';
            }

            // フォントオプションを更新
            createFontNameOptions();
            createFontNumberOptions();

            // プレビューを更新
            updatePreview();

            setTimeout(() => {
                refreshFontsButton.textContent = 'フォントリストを更新';
                refreshFontsButton.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('フォントリスト更新エラー:', error);
            refreshFontsButton.textContent = '更新エラー';

            setTimeout(() => {
                refreshFontsButton.textContent = 'フォントリストを更新';
                refreshFontsButton.disabled = false;
            }, 2000);
        }
    });

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

    // プレビュー領域の基本スタイルを設定（テキストの折り返し）
    previewText.style.wordWrap = 'break-word';
    previewText.style.overflowWrap = 'break-word';
    previewText.style.whiteSpace = 'pre-wrap';

    // スペルチェックをオフに設定
    previewText.setAttribute('spellcheck', 'false');

    // サンプルテキストを空に設定
    previewText.textContent = '';
    previewText.setAttribute('placeholder', 'ここに入力してください');

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

    // IndexedDBからフォントを読み込む
    async function loadFontsFromIndexedDB() {
        try {
            await initIndexedDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const indexedDBFonts = request.result.map(font => {
                        // フォント名から拡張子を除去して内部名とする
                        const displayName = font.name;
                        const name = font.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');
                        return { name, displayName, data: font.data };
                    });

                    console.log(`IndexedDBから${indexedDBFonts.length}個のフォントを読み込みました`);

                    // 直接フォントをページに追加
                    addFontsToPage(indexedDBFonts);

                    // fontsInFolderを更新
                    fontsInFolder = indexedDBFonts;

                    resolve(indexedDBFonts);
                };

                request.onerror = (e) => {
                    console.error('フォント読み込みエラー:', e.target.error);
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error('IndexedDBフォント読み込みエラー:', error);
            return [];
        }
    }

    // ページにフォントを追加
    async function addFontsToPage(fonts) {
        if (!fonts || fonts.length === 0) return;

        // 既存のスタイル要素を削除
        document.querySelectorAll('style.dynamic-font-faces').forEach(el => el.remove());

        // 既存のBlobURLを解放
        if (window.fontBlobUrls) {
            window.fontBlobUrls.forEach(url => {
                URL.revokeObjectURL(url);
            });
        }
        window.fontBlobUrls = [];
        window.fontNameToId = window.fontNameToId || new Map();

        console.log(`${fonts.length}個のフォントを登録します`);

        // 従来のCSSスタイルシート方式に戻す
        const styleElement = document.createElement('style');
        styleElement.className = 'dynamic-font-faces';
        let cssRules = '';
        window.fontBlobUrls = [];

        // フォントデータを処理
        fonts.forEach((font, index) => {
            if (!font.data) {
                console.warn(`フォント「${font.originalName}」にデータがありません`);
                return;
            }

            try {
                // シンプルで安全なフォントID（数字のみ）
                const fontFamilyName = `font-${index + 1}`;

                // 元のフォント名とIDをマッピング
                font.id = fontFamilyName;

                // originalNameがnullやundefinedの場合に対処
                const originalName = font.originalName || `unknown-font-${index}`;
                window.fontNameToId.set(originalName, fontFamilyName);

                // フォント番号がある場合は、フォント名_番号の形式も登録
                const parsed = parseFontName(originalName);
                if (parsed) {
                    window.fontNameToId.set(`${parsed.name}_${parsed.number}`, fontFamilyName);
                }

                try {
                    // ArrayBufferをBase64エンコードに変換
                    const base64Font = arrayBufferToBase64(font.data);
                    const mimeType = font.mimeType || 'font/woff2';
                    const dataUrl = `data:${mimeType};base64,${base64Font}`;

                    // @font-face ルールを追加
                    cssRules += `
@font-face {
  font-family: '${fontFamilyName}';
  src: url('${dataUrl}');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
                    console.log(`フォント「${originalName}」をデータURLで登録: ${fontFamilyName}`);
                } catch (fontFaceError) {
                    console.error(`フォント「${originalName}」のCSS生成エラー:`, fontFaceError);
                }
            } catch (error) {
                console.error(`フォント「${font.originalName || 'unknown'}」の処理エラー:`, error);
            }
        });

        // スタイル要素にCSSルールを設定
        styleElement.textContent = cssRules;
        document.head.appendChild(styleElement);
        console.log('フォントスタイルをページに追加しました');

        // すべてのフォントの読み込みを待つ
        try {
            await document.fonts.ready;
            console.log('すべてのフォントの読み込みが完了しました');
        } catch (e) {
            console.warn('フォントの読み込み待機中にエラーが発生しました:', e);
        }

        // プレビューを更新
        updatePreview();

        return fonts;
    }

    // ArrayBufferをBase64に変換する関数
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // MIMEタイプからフォーマット文字列を取得
    function getFormatFromMimeType(mimeType) {
        switch (mimeType) {
            case 'font/woff2': return 'woff2';
            case 'font/woff': return 'woff';
            case 'font/ttf': return 'truetype';
            case 'font/opentype': return 'opentype';
            default: return 'woff2';
        }
    }

    // fontsフォルダ内のフォントファイルを検出する関数
    async function detectFontsInFolder() {
        try {
            // まずローカルAPI経由でフォントリストを取得
            let fontFiles = [];

            try {
                const response = await fetch('/api/list-fonts');
                if (response.ok) {
                    fontFiles = await response.json();
                    console.log(`サーバーから${fontFiles.length}個のフォントファイルを取得しました`);
                }
            } catch (localApiError) {
                console.warn('ローカルAPIからのフォント取得に失敗しました:', localApiError);

                // ローカルAPIが失敗した場合、リポジトリから取得を試みる
                try {
                    await loadFontsFromRepository();
                    return fontsInFolder; // リポジトリからロードした値を返す
                } catch (repoError) {
                    console.error('リポジトリからのフォント取得にも失敗しました:', repoError);
                }
            }

            // フォントファイルを読み込む
            const fonts = [];
            for (const fontInfo of fontFiles) {
                try {
                    const fontPath = `/fonts/${fontInfo.name}`;
                    const response = await fetch(fontPath);
                    if (!response.ok) {
                        console.error(`フォントファイル「${fontPath}」の読み込みに失敗しました`);
                        continue;
                    }

                    const fontData = await response.arrayBuffer();
                    const displayName = fontInfo.name;
                    const name = displayName.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // MIMEタイプを判定
                    let fontMimeType;
                    if (fontInfo.name.endsWith('.woff2')) fontMimeType = 'font/woff2';
                    else if (fontInfo.name.endsWith('.woff')) fontMimeType = 'font/woff';
                    else if (fontInfo.name.endsWith('.ttf')) fontMimeType = 'font/ttf';
                    else if (fontInfo.name.endsWith('.otf')) fontMimeType = 'font/opentype';
                    else {
                        console.warn(`未知のフォント形式: ${fontInfo.name}`);
                        continue;
                    }

                    fonts.push({ name, displayName, data: fontData, mimeType: fontMimeType });
                    console.log(`フォントファイル「${fontPath}」を読み込みました`);
                } catch (error) {
                    console.error(`フォントファイル「${fontInfo.name}」の読み込みエラー:`, error);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                await addFontsToPage(fonts);
            } else {
                console.warn('フォントを取得できませんでした');
            }

            return fonts;
        } catch (error) {
            console.error('フォント検出エラー:', error);
            return [];
        }
    }

    // @font-face定義を動的に生成する関数
    function createFontFaceDefinitions(fonts) {
        // ここではIndexedDBから読み込んだフォントを使用するため、何もしない
        // IndexedDBからのフォントは既にaddFontsToPage()で処理されている
    }

    // フォントファイル一覧を取得して処理を開始
    let fontsInFolder = [];

    detectFontsInFolder().then(fonts => {
        fontsInFolder = fonts;

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
        const match = fontName.match(/^(.+?)[-_](\d+)$/);
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
            // originalNameがある場合はそれを使用、なければnameを使用
            const originalName = font.originalName || font.name;

            const parsed = parseFontName(originalName);
            if (parsed) {
                fontNames.add(parsed.name);
            } else {
                // パターンに一致しない場合は、フォント名全体を使用
                fontNames.add(originalName);
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

        // 選択された名前に対応する番号を収集
        const numbers = new Set();
        let hasNumbers = false;

        fontsInFolder.forEach(font => {
            const originalName = font.originalName || font.name;
            const parsed = parseFontName(originalName);
            if (parsed && parsed.name === selectedName) {
                numbers.add(parsed.number);
                hasNumbers = true;
                console.log("フォント番号を追加:", parsed.number);
            }
        });

        // 番号が見つからない場合は、選択されたフォント名と一致するフォントを使用
        if (!hasNumbers) {
            fontNumberSelect.disabled = true;
            return;
        }

        fontNumberSelect.disabled = false;

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
    useNormalFontCheckbox.addEventListener('change', () => {
        // チェックボックスの状態に応じてフォント選択欄の有効/無効を切り替え
        fontNameSelect.disabled = useNormalFontCheckbox.checked;
        fontNumberSelect.disabled = useNormalFontCheckbox.checked;
        updatePreview();
    });

    // プレビューの更新関数
    function updatePreview() {
        const selectedName = fontNameSelect.value;
        const selectedNumber = fontNumberSelect.value;
        const selectedSize = fontSizeInput.value;
        const selectedLetterSpacing = letterSpacingInput.value;
        const selectedLineHeight = lineHeightInput.value;
        const selectedWritingMode = writingModeSelect.value;
        const selectedTextAlign = textAlignSelect.value;
        const useNormalFont = useNormalFontCheckbox.checked;

        console.log("プレビュー更新:", selectedName, selectedNumber);

        // フォント名の設定
        let fontFamily;
        let fontDisplayName;

        if (useNormalFont) {
            // 通常のフォントを使用する場合
            fontFamily = 'Helvetica, Arial, sans-serif';
            fontDisplayName = 'Helvetica';
            console.log("通常フォント使用: Helvetica");
        } else if (selectedName && selectedNumber && !fontNumberSelect.disabled) {
            // フルネームの生成（元のフォント名フォーマットを保持）
            const originalFullName = `${selectedName}_${selectedNumber}`;

            // マッピングからフォントIDを取得
            const fontId = window.fontNameToId ?
                window.fontNameToId.get(originalFullName) : null;

            if (fontId) {
                fontFamily = `'${fontId}', sans-serif`;
                fontDisplayName = originalFullName;
                console.log(`カスタムフォント使用: ${originalFullName} -> ID: ${fontId}`);
            } else {
                // 見つからない場合はデフォルトフォント
                fontFamily = 'sans-serif';
                fontDisplayName = originalFullName + ' (見つかりません)';
                console.warn(`フォント「${originalFullName}」が見つかりません`);
            }
        } else if (selectedName) {
            // マッピングからフォントIDを取得
            const fontId = window.fontNameToId ?
                window.fontNameToId.get(selectedName) : null;

            if (fontId) {
                fontFamily = `'${fontId}', sans-serif`;
                fontDisplayName = selectedName;
                console.log(`番号なしカスタムフォント使用: ${selectedName} -> ID: ${fontId}`);
            } else {
                // 見つからない場合はデフォルトフォント
                fontFamily = 'sans-serif';
                fontDisplayName = selectedName + ' (見つかりません)';
                console.warn(`フォント「${selectedName}」が見つかりません`);
            }
        } else {
            fontFamily = 'sans-serif';
            fontDisplayName = 'デフォルト';
        }

        // フォントスタイルを適用
        applyStyles(fontFamily, fontDisplayName);

        // スタイルを適用する内部関数
        function applyStyles(fontFam, displayName) {
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
            previewText.style.fontFamily = fontFam;
            previewText.style.fontSize = `${selectedSize}px`;
            previewText.style.letterSpacing = `${selectedLetterSpacing}em`;
            previewText.style.lineHeight = selectedLineHeight;

            // 情報表示の更新
            currentFontDisplay.textContent = displayName;
            currentSizeDisplay.textContent = `${selectedSize}px`;
            currentLetterSpacingDisplay.textContent = `${selectedLetterSpacing}em`;
            currentLineHeightDisplay.textContent = selectedLineHeight;

            // 詳細設定の表示更新（文字方向）
            currentWritingModeDisplay.textContent = selectedWritingMode === 'horizontal-tb' ? '横書き' : '縦書き';
        }
    }

    // 名前と番号でフォントを検索する関数
    function findFontByNameAndNumber(name, number) {
        // フォント名から_番号の形式を探す
        return fontsInFolder.find(font => {
            const parsed = parseFontName(font.originalName);
            return parsed && parsed.name === name && parsed.number === number;
        });
    }

    // 名前のみでフォントを検索する関数
    function findFontByNameOnly(name) {
        // 完全一致するフォント名を探す
        return fontsInFolder.find(font => font.originalName === name);
    }

    // 初期化時にIndexedDBを開く
    initIndexedDB().catch(error => {
        console.error('IndexedDB初期化エラー:', error);
    });

    // フォント検出・読み込み部分の更新
    async function loadFontsFromRepository() {
        try {
            console.log('GitHubリポジトリからフォントを読み込みます...');

            // Netlify Functionsを使ってGitHubリポジトリからフォント一覧を取得
            const listResponse = await fetch('/.netlify/functions/list-fonts');
            if (!listResponse.ok) {
                const errorData = await listResponse.json();
                throw new Error(`フォント一覧の取得に失敗しました: ${errorData.error || listResponse.statusText}`);
            }

            const fontsList = await listResponse.json();
            console.log(`リポジトリから${fontsList.length}個のフォントを検出しました:`, fontsList.map(f => f.name).join(', '));

            if (fontsList.length === 0) {
                console.log('リポジトリにフォントファイルが見つかりませんでした');
                return [];
            }

            // フォントをダウンロードして追加
            const fonts = [];
            for (const font of fontsList) {
                try {
                    console.log(`リポジトリからフォント「${font.name}」をダウンロード: ${font.download_url}`);

                    // Netlify Functionsを通してフォントデータを取得
                    const fontResponse = await fetch(`/.netlify/functions/get-font/${encodeURIComponent(font.name)}`);
                    if (!fontResponse.ok) {
                        console.error(`フォント「${font.name}」のダウンロードに失敗しました: ${fontResponse.status}`);
                        continue;
                    }

                    const fontData = await fontResponse.arrayBuffer();
                    console.log(`フォント「${font.name}」(${fontData.byteLength}バイト)を読み込みました`);

                    // フォント名を解析（拡張子を除去）
                    const displayName = font.name;
                    const name = font.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // MIMEタイプを判定
                    let fontMimeType;
                    if (font.name.endsWith('.woff2')) fontMimeType = 'font/woff2';
                    else if (font.name.endsWith('.woff')) fontMimeType = 'font/woff';
                    else if (font.name.endsWith('.ttf')) fontMimeType = 'font/ttf';
                    else if (font.name.endsWith('.otf')) fontMimeType = 'font/opentype';
                    else {
                        console.warn(`未知のフォント形式: ${font.name}`);
                        continue;
                    }

                    fonts.push({
                        originalName: name,
                        displayName,
                        data: fontData,
                        mimeType: fontMimeType
                    });
                } catch (err) {
                    console.error(`フォント「${font.name}」の処理エラー:`, err);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                console.log(`GitHub経由で${fonts.length}個のフォントをページに追加します`);
                await addFontsToPage(fonts);

                // fontsInFolderに新しいフォントを設定（上書き）
                fontsInFolder = fonts;

                // IndexedDBにフォントを保存
                await saveFontsToIndexedDB(fonts);
            }

            return fonts;
        } catch (error) {
            console.error('GitHubリポジトリからのフォント読み込みエラー:', error);
            return [];
        }
    }

    // フォントをIndexedDBに保存（オフライン利用のため）
    async function saveFontsToIndexedDB(fonts) {
        try {
            await initIndexedDB();

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // 既存のフォントを一度クリアする
            store.clear();

            for (const font of fonts) {
                await new Promise((resolve, reject) => {
                    const request = store.put({
                        name: font.displayName,
                        data: font.data,
                        dateAdded: new Date().toISOString()
                    });

                    request.onsuccess = () => {
                        console.log(`フォント「${font.displayName}」をIndexedDBに保存しました`);
                        resolve();
                    };

                    request.onerror = (e) => {
                        console.error(`フォント「${font.displayName}」の保存エラー:`, e.target.error);
                        reject(e.target.error);
                    };
                });
            }

            console.log(`合計${fonts.length}個のフォントをIndexedDBに保存しました`);
        } catch (error) {
            console.error('IndexedDBへの保存エラー:', error);
        }
    }
}); 