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

    // 初期化処理を非同期で実行
    async function initialize() {
        try {
            // IndexedDBを初期化
            await initIndexedDB();

            // サーバーからフォントをロード
            await loadServerFonts();

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
            // サーバーへのアップロード処理
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('fonts', files[i]);
            }

            // サーバーAPIを呼び出し
            const response = await fetch('/api/upload-font', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'アップロードに失敗しました');
            }

            const result = await response.json();
            console.log('アップロード結果:', result);

            uploadStatus.textContent = result.message || `${result.files.length}個のフォントを保存しました。`;
            uploadStatus.style.color = '#27ae60';

            // アップロードリスト更新
            loadUploadedFontsToList();

            // フォントリストを更新してプレビューに反映
            await loadServerFonts();
            createFontNameOptions();
            createFontNumberOptions();
            updatePreview();

            // IndexedDBにもフォントを保存（オフライン利用のため）
            await saveServerFontsToIndexedDB(result.files.map(file => file.name));

        } catch (error) {
            console.error('フォントアップロードエラー:', error);
            uploadStatus.textContent = `エラー: ${error.message || error}`;
            uploadStatus.style.color = '#e74c3c';
        }

        // フォーム初期化
        fontUpload.value = '';
    });

    // サーバーからフォントリストを取得
    async function loadServerFonts() {
        try {
            const response = await fetch('/api/list-fonts');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'フォントリスト取得に失敗しました');
            }

            const fontsList = await response.json();
            console.log(`サーバーから${fontsList.length}個のフォントファイルを取得しました`);

            // サーバーフォントを取得してロード
            const serverFonts = await loadFontsFromServer(fontsList);

            // fontsInFolderを更新
            fontsInFolder = serverFonts;

            return serverFonts;
        } catch (error) {
            console.error('サーバーフォント取得エラー:', error);
            return [];
        }
    }

    // サーバーからフォントファイルを取得してロード
    async function loadFontsFromServer(fontsList) {
        try {
            const fonts = [];

            for (const fontInfo of fontsList) {
                try {
                    // サーバーからフォントデータを取得
                    const fontUrl = `/api/font/${encodeURIComponent(fontInfo.name)}`;
                    console.log(`フォント「${fontInfo.name}」をリクエスト: ${fontUrl}`);

                    // キャッシュバスティングを追加（開発時のみ）
                    const requestUrl = fontUrl + (window.location.hostname === 'localhost' ?
                        `?_=${new Date().getTime()}` : '');

                    const response = await fetch(requestUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': '*/*',
                            'Cache-Control': 'no-cache'
                        },
                        credentials: 'same-origin'
                    });

                    if (!response.ok) {
                        console.error(`フォント「${fontInfo.name}」の取得に失敗しました: ${response.status} ${response.statusText}`);
                        continue;
                    }

                    // レスポンスヘッダーの確認
                    console.log(`フォント「${fontInfo.name}」のレスポンスヘッダー:`,
                        Array.from(response.headers.entries())
                            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
                    );

                    const fontData = await response.arrayBuffer();
                    console.log(`フォント「${fontInfo.name}」を取得しました (${fontData.byteLength} bytes)`);

                    const displayName = fontInfo.name;
                    const name = fontInfo.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // CSS識別子として安全なフォント名に変換
                    const cssName = name.replace(/[^a-zA-Z0-9\-]/g, '-');
                    console.log(`フォント名「${name}」をCSS識別子「${cssName}」に変換しました`);

                    fonts.push({ name: cssName, originalName: name, displayName, data: fontData });

                } catch (err) {
                    console.error(`フォント「${fontInfo.name}」の読み込みエラー:`, err);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                console.log(`${fonts.length}個のフォントをページに追加します`);
                addFontsToPage(fonts);
            } else {
                console.warn('サーバーからフォントを取得できませんでした');
            }

            return fonts;
        } catch (error) {
            console.error('サーバーフォントのロードエラー:', error);
            return [];
        }
    }

    // サーバーからロードしたフォントをIndexedDBに保存（オフライン利用のため）
    async function saveServerFontsToIndexedDB(fontNames) {
        try {
            await initIndexedDB();

            for (const fontName of fontNames) {
                try {
                    // すでに保存済みかチェック
                    const existingFont = await checkFontExists(fontName);
                    if (existingFont) {
                        console.log(`フォント「${fontName}」は既にIndexedDBに保存されています`);
                        continue;
                    }

                    // サーバーからフォントデータを取得
                    const response = await fetch(`/api/font/${encodeURIComponent(fontName)}`);
                    if (!response.ok) {
                        console.error(`フォント「${fontName}」の取得に失敗しました`);
                        continue;
                    }

                    const fontData = await response.arrayBuffer();

                    // IndexedDBに保存
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);

                    await new Promise((resolve, reject) => {
                        const request = store.put({
                            name: fontName,
                            data: fontData,
                            dateAdded: new Date().toISOString()
                        });

                        request.onsuccess = () => {
                            console.log(`フォント「${fontName}」をIndexedDBに保存しました`);
                            resolve();
                        };

                        request.onerror = (e) => {
                            console.error(`フォント「${fontName}」の保存エラー:`, e.target.error);
                            reject(e.target.error);
                        };
                    });

                } catch (err) {
                    console.error(`フォント「${fontName}」の保存処理エラー:`, err);
                }
            }
        } catch (error) {
            console.error('IndexedDBへの保存エラー:', error);
        }
    }

    // フォントがIndexedDBに存在するかチェック
    async function checkFontExists(fontName) {
        try {
            await initIndexedDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.get(fontName);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = (e) => {
                    console.error('フォント存在チェックエラー:', e.target.error);
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error('IndexedDBチェックエラー:', error);
            return null;
        }
    }

    // アップロードされたフォントをリストに表示
    async function loadUploadedFontsToList() {
        try {
            // サーバーからフォントリストを取得
            const response = await fetch('/api/list-fonts');
            if (!response.ok) {
                throw new Error('フォントリスト取得に失敗しました');
            }

            const fonts = await response.json();
            uploadedFontsList.innerHTML = '';

            if (fonts.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'アップロードされたフォントはありません';
                uploadedFontsList.appendChild(li);
                return;
            }

            fonts.forEach(font => {
                const li = document.createElement('li');
                li.className = 'font-item';

                // フォント名
                const nameSpan = document.createElement('span');
                nameSpan.textContent = font.name;
                nameSpan.className = 'font-name';
                li.appendChild(nameSpan);

                // 削除ボタン
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '削除';
                deleteBtn.className = 'delete-font-btn';
                deleteBtn.addEventListener('click', async () => {
                    await deleteFont(font.name);
                });
                li.appendChild(deleteBtn);

                uploadedFontsList.appendChild(li);
            });
        } catch (error) {
            console.error('フォントリスト更新エラー:', error);
        }
    }

    // フォントを削除
    async function deleteFont(fontName) {
        try {
            // サーバーからフォントを削除
            const response = await fetch(`/api/font/${encodeURIComponent(fontName)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'フォント削除に失敗しました');
            }

            const result = await response.json();
            console.log(result.message);

            // IndexedDBからも削除
            try {
                await initIndexedDB();
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.delete(fontName);
            } catch (dbError) {
                console.error('IndexedDBからの削除エラー:', dbError);
            }

            // リストを更新
            await loadUploadedFontsToList();

            // フォントリストを更新してプレビューに反映
            await loadServerFonts();
            createFontNameOptions();
            createFontNumberOptions();
            updatePreview();

        } catch (error) {
            console.error('フォント削除エラー:', error);
            alert(`エラー: ${error.message || error}`);
        }
    }

    // フォントリストの更新ボタン
    refreshFontsButton.addEventListener('click', async () => {
        try {
            // サーバーからフォントを再ロード
            await loadServerFonts();

            // フォントオプションを更新
            createFontNameOptions();
            createFontNumberOptions();

            // プレビューを更新
            updatePreview();

            // アップロードされたフォントリストを更新
            await loadUploadedFontsToList();

            refreshFontsButton.textContent = 'フォントリストを更新しました！';
            setTimeout(() => {
                refreshFontsButton.textContent = 'フォントリストを更新';
            }, 2000);
        } catch (error) {
            console.error('フォントリスト更新エラー:', error);
            refreshFontsButton.textContent = 'エラーが発生しました';
            setTimeout(() => {
                refreshFontsButton.textContent = 'フォントリストを更新';
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
    function addFontsToPage(fonts) {
        if (!fonts || fonts.length === 0) return;

        // 既存のスタイル要素を削除
        document.querySelectorAll('style.dynamic-font-faces').forEach(el => el.remove());

        // 既存のCSSルールを削除
        document.fonts.forEach(font => {
            if (font.family.startsWith("'") && font.family.endsWith("'")) {
                // カスタムフォントを削除
                try {
                    document.fonts.delete(font);
                } catch (e) {
                    console.warn('フォント削除エラー:', e);
                }
            }
        });

        console.log(`${fonts.length}個のフォントを登録します`);

        // フォントデータを処理
        fonts.forEach(font => {
            if (!font.data) {
                console.warn(`フォント「${font.name}」にデータがありません`);
                return;
            }

            try {
                // 適切なMIMEタイプを設定
                let format;
                if (font.displayName.endsWith('.woff2')) {
                    format = 'woff2';
                } else if (font.displayName.endsWith('.woff')) {
                    format = 'woff';
                } else if (font.displayName.endsWith('.ttf')) {
                    format = 'truetype';
                } else if (font.displayName.endsWith('.otf')) {
                    format = 'opentype';
                } else {
                    console.warn(`不明なフォント形式: ${font.displayName}`);
                    return;
                }

                // ArrayBufferをBlobに変換
                const fontBlob = new Blob([font.data]);

                // 安全なフォント名を使用
                const safeFontName = font.name.replace(/[^a-zA-Z0-9\-]/g, '-');
                console.log(`FontFace登録: ${safeFontName}`);

                // FontFaceを使用して直接フォントを登録
                const fontFace = new FontFace(
                    safeFontName,
                    fontBlob,
                    {
                        style: 'normal',
                        weight: 'normal',
                        display: 'swap'
                    }
                );

                // フォント読み込み完了時の処理
                fontFace.load().then(loadedFace => {
                    // フォントをドキュメントに追加
                    document.fonts.add(loadedFace);
                    console.log(`フォント追加完了: ${safeFontName} (${format}形式)`);

                    // プレビューを更新（非同期で読み込まれるため）
                    updatePreview();
                }).catch(err => {
                    console.error(`フォント「${safeFontName}」の読み込みエラー:`, err);
                });
            } catch (error) {
                console.error(`フォント「${font.name}」の処理エラー:`, error);
            }
        });
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
            // フォントファイルのパスを指定
            const fontFiles = [
                'fonts/AZEGAMI_01.woff2',
                'fonts/AZEGAMI_02.woff2',
                'fonts/TEST_03.woff2'
            ];

            // フォントファイルを読み込む
            const fonts = [];
            for (const fontPath of fontFiles) {
                try {
                    const response = await fetch(fontPath);
                    if (!response.ok) {
                        console.error(`フォントファイル「${fontPath}」の読み込みに失敗しました`);
                        continue;
                    }

                    const fontData = await response.arrayBuffer();
                    const displayName = fontPath.split('/').pop();
                    const name = displayName.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    fonts.push({ name, displayName, data: fontData });
                    console.log(`フォントファイル「${fontPath}」を読み込みました`);
                } catch (error) {
                    console.error(`フォントファイル「${fontPath}」の読み込みエラー:`, error);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                addFontsToPage(fonts);
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

            // 安全なフォント名に変換
            const safeFontName = originalFullName.replace(/[^a-zA-Z0-9\-]/g, '-');

            // 引用符を削除してフォントファミリー名を設定
            fontFamily = `${safeFontName}, sans-serif`;
            fontDisplayName = originalFullName;
            console.log("カスタムフォント使用:", originalFullName, "->", safeFontName);
        } else if (selectedName) {
            // 番号がない場合はフォント名のみを使用
            // 安全なフォント名に変換
            const safeFontName = selectedName.replace(/[^a-zA-Z0-9\-]/g, '-');

            // 引用符を削除してフォントファミリー名を設定
            fontFamily = `${safeFontName}, sans-serif`;
            fontDisplayName = selectedName;
            console.log("番号なしカスタムフォント使用:", selectedName, "->", safeFontName);
        } else {
            fontFamily = 'sans-serif';
            fontDisplayName = 'デフォルト';
        }

        // フォントが読み込まれたか確認し、必要に応じて待機
        if (!useNormalFont && selectedName) {
            const fontToCheck = selectedNumber && !fontNumberSelect.disabled ?
                `${selectedName}_${selectedNumber}` : selectedName;

            // 安全なフォント名に変換
            const safeFontToCheck = fontToCheck.replace(/[^a-zA-Z0-9\-]/g, '-');

            // フォントが読み込まれるのを待つ
            document.fonts.ready.then(() => {
                const fontLoaded = Array.from(document.fonts).some(font =>
                    font.family.replace(/['\"]/g, '') === safeFontToCheck ||
                    font.family === safeFontToCheck
                );

                if (fontLoaded) {
                    console.log(`フォント「${fontToCheck}」は読み込まれています`);
                } else {
                    console.warn(`フォント「${fontToCheck}」はまだ読み込まれていません（安全名: ${safeFontToCheck}）`);
                    console.log('現在利用可能なフォント:',
                        Array.from(document.fonts).map(f => f.family).join(', '));
                }

                // フォントがロードされていようがいまいが、スタイルを適用
                applyStyles(fontFamily, fontDisplayName);
            });
        } else {
            // 通常フォントの場合はすぐに適用
            applyStyles(fontFamily, fontDisplayName);
        }

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

    // 初期化時にIndexedDBを開く
    initIndexedDB().catch(error => {
        console.error('IndexedDB初期化エラー:', error);
    });
}); 