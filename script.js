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

    // 管理者機能の要素
    const adminToggle = document.getElementById('admin-toggle');
    const adminPanel = document.getElementById('admin-panel');
    const fontUpload = document.getElementById('font-upload');
    const uploadStatus = document.getElementById('upload-status');
    const uploadedFontsList = document.getElementById('uploaded-fonts');
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

    // 管理者パネルの表示切り替え
    adminToggle.addEventListener('click', () => {
        adminPanel.classList.toggle('hidden');
        if (!adminPanel.classList.contains('hidden')) {
            loadUploadedFontsToList();
        }
    });

    // フォントファイルをアップロード
    fontUpload.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        uploadStatus.textContent = `${files.length}個のファイルを処理中...`;
        uploadStatus.style.color = '#3498db';

        try {
            await initIndexedDB();
            let successCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // フォントファイルかチェック
                if (!file.name.match(/\.(woff2|woff|ttf|otf)$/i)) {
                    continue;
                }

                const reader = new FileReader();

                await new Promise((resolve, reject) => {
                    reader.onload = async (e) => {
                        try {
                            const fontData = e.target.result;
                            const fontName = file.name;

                            // フォントデータを保存
                            const transaction = db.transaction([STORE_NAME], 'readwrite');
                            const store = transaction.objectStore(STORE_NAME);

                            await new Promise((transResolve, transReject) => {
                                const request = store.put({
                                    name: fontName,
                                    data: fontData,
                                    dateAdded: new Date().toISOString()
                                });

                                request.onsuccess = () => {
                                    successCount++;
                                    transResolve();
                                };

                                request.onerror = (e) => {
                                    console.error('フォント保存エラー:', e.target.error);
                                    transReject(e.target.error);
                                };
                            });

                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    };

                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(file);
                });
            }

            uploadStatus.textContent = `${successCount}個のフォントを保存しました。`;
            uploadStatus.style.color = '#27ae60';

            // アップロードリスト更新
            loadUploadedFontsToList();

            // フォントリストを更新してプレビューに反映
            await loadFontsFromIndexedDB();
            createFontNameOptions();
            createFontNumberOptions();
            updatePreview();

        } catch (error) {
            console.error('フォントアップロードエラー:', error);
            uploadStatus.textContent = `エラー: ${error.message || error}`;
            uploadStatus.style.color = '#e74c3c';
        }

        // フォーム初期化
        fontUpload.value = '';
    });

    // アップロードされたフォントをリストに表示
    async function loadUploadedFontsToList() {
        try {
            await initIndexedDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const fonts = request.result;
                uploadedFontsList.innerHTML = '';

                if (fonts.length === 0) {
                    const li = document.createElement('li');
                    li.textContent = 'アップロードされたフォントはありません';
                    uploadedFontsList.appendChild(li);
                    return;
                }

                fonts.forEach(font => {
                    const li = document.createElement('li');
                    li.textContent = font.name;
                    uploadedFontsList.appendChild(li);
                });
            };

            request.onerror = (e) => {
                console.error('フォントリスト取得エラー:', e.target.error);
            };
        } catch (error) {
            console.error('フォントリスト更新エラー:', error);
        }
    }

    // フォントリストの更新ボタン
    refreshFontsButton.addEventListener('click', async () => {
        try {
            await loadFontsFromIndexedDB();
            createFontNameOptions();
            createFontNumberOptions();
            updatePreview();

            refreshFontsButton.textContent = 'フォントリストを更新しました！';
            setTimeout(() => {
                refreshFontsButton.textContent = 'フォントリストを更新';
            }, 2000);
        } catch (error) {
            console.error('フォントリスト更新エラー:', error);
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
                    addFontsToPage(indexedDBFonts);
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
    function addFontsToPage(fonts) {
        if (!fonts || fonts.length === 0) return;

        // 既存のスタイル要素を削除
        document.querySelectorAll('style.dynamic-font-faces').forEach(el => el.remove());

        // 新しいスタイル要素を作成
        const style = document.createElement('style');
        style.className = 'dynamic-font-faces';

        // 各フォントデータをBlobに変換してURLを作成
        fonts.forEach(font => {
            if (!font.data) return;

            // 適切なMIMEタイプを設定
            let mimeType;
            if (font.displayName.endsWith('.woff2')) {
                mimeType = 'font/woff2';
            } else if (font.displayName.endsWith('.woff')) {
                mimeType = 'font/woff';
            } else if (font.displayName.endsWith('.ttf')) {
                mimeType = 'font/ttf';
            } else if (font.displayName.endsWith('.otf')) {
                mimeType = 'font/otf';
            } else {
                return;
            }

            // Blobを作成
            const blob = new Blob([font.data], { type: mimeType });
            const fontUrl = URL.createObjectURL(blob);

            // @font-face定義を追加
            style.textContent += `
@font-face {
    font-family: '${font.name}';
    src: url('${fontUrl}') format('${mimeType.split('/')[1]}');
    font-weight: normal;
    font-style: normal;
}`;
        });

        // スタイル要素をドキュメントに追加
        document.head.appendChild(style);
    }

    // fontsフォルダ内のフォントファイルを検出する関数
    async function detectFontsInFolder() {
        try {
            // IndexedDBからフォントを読み込む
            const dbFonts = await loadFontsFromIndexedDB();
            if (dbFonts && dbFonts.length > 0) {
                return dbFonts;
            }

            // IndexedDBにフォントがない場合はデフォルトフォントを使用
            console.log('デフォルトフォントを使用します');
            return [
                { name: 'AZEGAMI_01', displayName: 'AZEGAMI_01.woff2' },
                { name: 'AZEGAMI_02', displayName: 'AZEGAMI_02.woff2' },
                { name: 'TEST_03', displayName: 'TEST_03.woff2' }
            ];
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
            } else {
                // パターンに一致しない場合は、フォント名全体を使用
                fontNames.add(font.name);
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
            const parsed = parseFontName(font.name);
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

        if (useNormalFont) {
            // 通常のフォントを使用する場合
            fontFamily = 'Helvetica, Arial, sans-serif';
            console.log("通常フォント使用: Helvetica");
        } else if (selectedName && selectedNumber && !fontNumberSelect.disabled) {
            // フルネームの生成
            const fullFontName = `${selectedName}_${selectedNumber}`;
            fontFamily = `"${fullFontName}"`;
            console.log("カスタムフォント使用:", fullFontName);
        } else if (selectedName) {
            // 番号がない場合はフォント名のみを使用
            fontFamily = `"${selectedName}"`;
            console.log("番号なしカスタムフォント使用:", selectedName);
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
        if (useNormalFont) {
            currentFontDisplay.textContent = 'Helvetica';
        } else if (selectedName && selectedNumber && !fontNumberSelect.disabled) {
            currentFontDisplay.textContent = `${selectedName}_${selectedNumber}`;
        } else if (selectedName) {
            currentFontDisplay.textContent = selectedName;
        } else {
            currentFontDisplay.textContent = 'デフォルト';
        }

        currentSizeDisplay.textContent = `${selectedSize}px`;
        currentLetterSpacingDisplay.textContent = `${selectedLetterSpacing}em`;
        currentLineHeightDisplay.textContent = selectedLineHeight;

        // 詳細設定の表示更新（文字方向）
        currentWritingModeDisplay.textContent = selectedWritingMode === 'horizontal-tb' ? '横書き' : '縦書き';
    }

    // 初期化時にIndexedDBを開く
    initIndexedDB().catch(error => {
        console.error('IndexedDB初期化エラー:', error);
    });
}); 