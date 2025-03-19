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
        console.log(`フォント名を解析: ${fontName}`);

        // まず、拡張子を削除
        const nameWithoutExt = fontName.replace(/\.(woff2|woff|ttf|otf)$/i, '');

        // パターン1: name_123 or name-123 形式
        let match = nameWithoutExt.match(/^(.+?)[-_](\d+)$/);
        if (match) {
            console.log(`パターン1で一致: 名前=${match[1]}, 番号=${match[2]}`);
            return {
                name: match[1],
                number: match[2]
            };
        }

        // パターン2: name123 形式（アルファベットの後に数字）
        match = nameWithoutExt.match(/^([A-Za-z]+)(\d+)$/);
        if (match) {
            console.log(`パターン2で一致: 名前=${match[1]}, 番号=${match[2]}`);
            return {
                name: match[1],
                number: match[2]
            };
        }

        // パターン3: 123name 形式（数字の後にアルファベット）
        match = nameWithoutExt.match(/^(\d+)([A-Za-z]+)$/);
        if (match) {
            console.log(`パターン3で一致: 名前=${match[2]}, 番号=${match[1]}`);
            return {
                name: match[2],
                number: match[1]
            };
        }

        // パターン4: TEST_03のような形式
        match = nameWithoutExt.match(/^([A-Za-z0-9]+)[_-](\d+)$/i);
        if (match) {
            console.log(`パターン4で一致: 名前=${match[1]}, 番号=${match[2]}`);
            return {
                name: match[1],
                number: match[2]
            };
        }

        // パターンに一致しない場合は、フォント名全体を名前として扱う
        console.log(`パターンに一致しません。フォント名全体を使用: ${nameWithoutExt}`);
        return {
            name: nameWithoutExt,
            number: null
        };
    }

    // フォント名オプションを生成
    function createFontNameOptions() {
        // 既存のオプションをクリア
        while (fontNameSelect.options.length > 0) {
            fontNameSelect.remove(0);
        }

        const fontNames = new Set();
        console.log(`createFontNameOptions: ${fontsInFolder.length}個のフォントから名前を収集`);

        // フォント名を収集
        fontsInFolder.forEach(font => {
            // originalNameがある場合はそれを使用、なければnameを使用
            const originalName = font.originalName || font.name;
            console.log(`フォント処理: originalName=${originalName}, displayName=${font.displayName}`);

            const parsed = parseFontName(originalName);
            if (parsed) {
                if (parsed.name) {
                    fontNames.add(parsed.name);
                    console.log(`フォント名を追加: ${parsed.name}`);
                } else {
                    // 名前がない場合は元の名前を使用
                    fontNames.add(originalName);
                    console.log(`フォント名（元）を追加: ${originalName}`);
                }
            } else {
                // パターンに一致しない場合は、フォント名全体を使用
                fontNames.add(originalName);
                console.log(`フォント名（フルネーム）を追加: ${originalName}`);
            }
        });

        // もしフォントが見つからなければ、デフォルトのオプションを追加
        if (fontNames.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'デフォルト';
            fontNameSelect.appendChild(option);
            fontNameSelect.disabled = true;
            fontNumberSelect.disabled = true;
            console.log("フォントが見つからないため、デフォルトオプションを追加しました");
            return;
        }

        fontNameSelect.disabled = false;

        // オプションを生成（アルファベット順でソート）
        Array.from(fontNames).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            fontNameSelect.appendChild(option);
        });

        console.log(`${fontNames.size}個のフォント名オプション生成完了: ${Array.from(fontNames).join(', ')}`);
    }

    // フォント番号オプションを生成
    function createFontNumberOptions() {
        // 既存のオプションをクリア
        while (fontNumberSelect.options.length > 0) {
            fontNumberSelect.remove(0);
        }

        const selectedName = fontNameSelect.value;
        console.log(`選択されたフォント名: ${selectedName}`);

        if (!selectedName) {
            fontNumberSelect.disabled = true;
            return;
        }

        // 選択されたフォント名に対応する番号を収集
        const numbers = new Set();
        fontsInFolder.forEach(font => {
            // originalNameがある場合はそれを使用、なければnameを使用
            const originalName = font.originalName || font.name;
            const parsed = parseFontName(originalName);

            if (parsed && parsed.name === selectedName && parsed.number) {
                numbers.add(parsed.number);
                console.log(`フォント番号を追加: ${parsed.number}`);
            }
        });

        fontNumberSelect.disabled = numbers.size === 0;

        // オプションを生成（数値順でソート）
        Array.from(numbers)
            .sort((a, b) => {
                // 数値として比較を試みる
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                // 両方が有効な数値なら数値として比較
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                // そうでなければ文字列として比較
                return String(a).localeCompare(String(b));
            })
            .forEach(number => {
                const option = document.createElement('option');
                option.value = number;
                option.textContent = number;
                fontNumberSelect.appendChild(option);
            });

        console.log(`${numbers.size}個のフォント番号オプション生成完了: ${Array.from(numbers).join(', ')}`);

        // 番号がなければ、フォント名だけで十分であることを示すオプションを追加
        if (numbers.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'なし';
            fontNumberSelect.appendChild(option);
            console.log("番号のないフォントのため、「なし」オプションを追加");
        }
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

        console.log(`プレビュー更新 - 選択名: ${selectedName}, 選択番号: ${selectedNumber}`);

        // フォント名が選択されていない場合
        if (!selectedName) {
            console.log("フォント名が選択されていないためプレビューをリセット");
            resetPreview();
            return;
        }

        // 選択されたフォントを見つける
        let selectedFont = null;

        // まず、フォント名と番号の両方で検索
        if (selectedNumber !== '' && selectedNumber !== 'なし') {
            console.log(`名前と番号で検索: ${selectedName}, ${selectedNumber}`);
            selectedFont = fontsInFolder.find(font => {
                const originalName = font.originalName || font.name;
                const parsed = parseFontName(originalName);
                return parsed && parsed.name === selectedName && parsed.number === selectedNumber;
            });
        }

        // 番号なしの場合または番号指定での検索が失敗した場合、名前だけで検索
        if (!selectedFont) {
            console.log(`番号なしまたは名前のみで検索: ${selectedName}`);
            selectedFont = fontsInFolder.find(font => {
                const originalName = font.originalName || font.name;
                const parsed = parseFontName(originalName);
                return parsed && parsed.name === selectedName;
            });
        }

        // フォントが見つからない場合
        if (!selectedFont) {
            console.log("該当するフォントが見つからないためプレビューをリセット");
            resetPreview();
            return;
        }

        console.log(`選択されたフォント: `, selectedFont);

        // 選択されたフォントのデータURLを取得
        const fontDataUrl = selectedFont.dataUrl;
        const fontName = selectedFont.displayName || selectedFont.name;

        // フォントの詳細情報を表示
        fontDataElement.textContent = fontName;

        // フォントスタイルを適用
        const fontFace = new FontFace(fontName, `url(${fontDataUrl})`);
        fontFace.load().then(loadedFace => {
            document.fonts.add(loadedFace);

            // プレビューにフォントを適用
            previewElement.style.fontFamily = `"${fontName}", sans-serif`;
            console.log(`フォント "${fontName}" を適用しました`);

            // フォントの読み込み状態を更新
            fontStatusElement.textContent = `フォント "${fontName}" を読み込みました`;
            fontStatusElement.style.color = 'green';
        }).catch(error => {
            console.error("フォントの読み込みに失敗:", error);
            fontStatusElement.textContent = `エラー: フォント "${fontName}" の読み込みに失敗しました`;
            fontStatusElement.style.color = 'red';
        });
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
            // クエリパラメータにタイムスタンプを追加してキャッシュを回避
            const timestamp = new Date().getTime();
            const listResponse = await fetch(`/.netlify/functions/list-fonts?t=${timestamp}`);

            if (!listResponse.ok) {
                let errorMsg = `フォント一覧の取得に失敗しました: ${listResponse.status} ${listResponse.statusText}`;
                try {
                    const errorData = await listResponse.json();
                    errorMsg += ` - ${JSON.stringify(errorData)}`;
                } catch (e) { }

                throw new Error(errorMsg);
            }

            const fontsList = await listResponse.json();
            console.log(`リポジトリから${fontsList.length}個のフォントを検出しました:`, fontsList.map(f => f.name).join(', '));

            if (fontsList.length === 0) {
                console.log('リポジトリにフォントファイルが見つかりませんでした');

                // 代替手段としてlocalStorage内のフォントを確認（もしあれば）
                await loadFontsFromIndexedDB();
                return [];
            }

            // フォントをダウンロードして追加
            const fonts = [];
            let successCount = 0;
            let errorCount = 0;

            for (const font of fontsList) {
                try {
                    console.log(`リポジトリからフォント「${font.name}」をダウンロード...`);

                    // 直接GitHubのダウンロードURLを使用（より信頼性が高い）
                    let fontUrl = font.download_url;
                    if (!fontUrl) {
                        console.warn(`フォント「${font.name}」のダウンロードURLがありません。Netlify Functions経由でアクセスします...`);
                        fontUrl = `/.netlify/functions/get-font/${encodeURIComponent(font.name)}?t=${timestamp}`;
                    }

                    // フォントファイルを取得
                    const fontResponse = await fetch(fontUrl);
                    if (!fontResponse.ok) {
                        console.error(`フォント「${font.name}」のダウンロードに失敗しました: ${fontResponse.status}`);
                        errorCount++;
                        continue;
                    }

                    const fontData = await fontResponse.arrayBuffer();
                    console.log(`フォント「${font.name}」(${fontData.byteLength}バイト)を読み込みました`);

                    // フォント名を解析（拡張子を除去）
                    const displayName = font.name;
                    const originalName = font.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // MIMEタイプを判定
                    let fontMimeType;
                    if (font.name.endsWith('.woff2')) fontMimeType = 'font/woff2';
                    else if (font.name.endsWith('.woff')) fontMimeType = 'font/woff';
                    else if (font.name.endsWith('.ttf')) fontMimeType = 'font/ttf';
                    else if (font.name.endsWith('.otf')) fontMimeType = 'font/opentype';
                    else {
                        console.warn(`未知のフォント形式: ${font.name}`);
                        errorCount++;
                        continue;
                    }

                    fonts.push({
                        originalName,
                        displayName,
                        data: fontData,
                        mimeType: fontMimeType
                    });

                    successCount++;
                } catch (err) {
                    console.error(`フォント「${font.name}」の処理エラー:`, err);
                    errorCount++;
                }
            }

            console.log(`フォント取得結果: 成功=${successCount}, 失敗=${errorCount}`);

            // フォントをページに追加
            if (fonts.length > 0) {
                console.log(`GitHub経由で${fonts.length}個のフォントをページに追加します`);
                await addFontsToPage(fonts);

                // fontsInFolderに新しいフォントを設定（上書き）
                fontsInFolder = fonts;

                // IndexedDBにフォントを保存
                await saveFontsToIndexedDB(fonts);

                // UIを更新
                createFontNameOptions();
                createFontNumberOptions();
                updatePreview();

                return fonts;
            } else {
                console.warn('フォントを追加できませんでした。IndexedDBから読み込みを試みます...');
                await loadFontsFromIndexedDB();
                return [];
            }
        } catch (error) {
            console.error('GitHubリポジトリからのフォント読み込みエラー:', error);

            // エラー時はIndexedDBから読み込みを試みる
            console.log('IndexedDBからフォントの読み込みを試みます...');
            await loadFontsFromIndexedDB();
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

    // プレビューをリセットする関数
    function resetPreview() {
        // フォント情報をリセット
        fontDataElement.textContent = 'フォントが選択されていません';

        // プレビュー表示をデフォルトに戻す
        previewElement.style.fontFamily = 'sans-serif';

        // フォントステータスをリセット
        fontStatusElement.textContent = 'フォントが読み込まれていません';
        fontStatusElement.style.color = '#666';

        console.log('プレビューをリセットしました');
    }
}); 