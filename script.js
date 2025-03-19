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

                    const fontData = await response.arrayBuffer();
                    console.log(`フォント「${fontInfo.name}」を取得しました (${fontData.byteLength} bytes)`);

                    const displayName = fontInfo.name;
                    const name = fontInfo.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // フォントのMIMEタイプを判定
                    let fontMimeType;
                    if (fontInfo.name.endsWith('.woff2')) {
                        fontMimeType = 'font/woff2';
                    } else if (fontInfo.name.endsWith('.woff')) {
                        fontMimeType = 'font/woff';
                    } else if (fontInfo.name.endsWith('.ttf')) {
                        fontMimeType = 'font/ttf';
                    } else if (fontInfo.name.endsWith('.otf')) {
                        fontMimeType = 'font/opentype';
                    } else {
                        console.warn(`未知のフォント形式: ${fontInfo.name}`);
                        continue;
                    }

                    // オリジナルのフォント名を保持
                    const fontObj = {
                        originalName: name,
                        displayName,
                        data: fontData,
                        mimeType: fontMimeType
                    };

                    fonts.push(fontObj);

                } catch (err) {
                    console.error(`フォント「${fontInfo.name}」の読み込みエラー:`, err);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                console.log(`${fonts.length}個のフォントをページに追加します`);
                await addFontsToPage(fonts);
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
            // 静的サイト向けに変更：fontsディレクトリを直接リクエスト
            const fontsPath = '/fonts/';

            // フォントリスト用のリクエスト（GitHubの場合は直接ディレクトリリストが取得できないため、コード対応が必要）
            try {
                // サーバーから提供されるJSONリストがある場合（推奨、自動デプロイ時に生成されるべき）
                const response = await fetch('/fontlist.json');

                if (response.ok) {
                    // JSONリストがある場合はそれを使用
                    const fontFiles = await response.json();
                    console.log(`fontlist.jsonから${fontFiles.length}個のフォントファイルを取得しました`);
                    await loadFontsFromList(fontFiles, fontsPath);
                    return;
                }
            } catch (listError) {
                console.log('fontlist.jsonが見つかりません。直接ファイル取得を試みます。');
            }

            // フォールバック：直接ディレクトリ内の.woffや.ttfファイルを試行
            // 注：これは効率的ではありませんが、静的サイトでの代替手段として機能します
            const fontExtensions = ['.woff2', '.woff', '.ttf', '.otf'];
            const fonts = [];

            // TEST_01～TEST_10.woff2のような命名パターンを想定してフォントを試行
            for (let i = 1; i <= 50; i++) {
                const num = i.toString().padStart(2, '0');
                for (const ext of fontExtensions) {
                    const fontName = `TEST_${num}${ext}`;
                    try {
                        const fontUrl = `${fontsPath}${fontName}`;
                        console.log(`フォントを試行: ${fontUrl}`);

                        const fontResponse = await fetch(fontUrl, { method: 'HEAD' });
                        if (fontResponse.ok) {
                            // ファイルが存在する場合
                            console.log(`フォントが見つかりました: ${fontName}`);
                            fonts.push({
                                name: fontName,
                                url: fontUrl
                            });
                        }
                    } catch (e) {
                        // 404などのエラーは正常、ファイルが存在しないだけ
                        console.log(`フォント${fontName}は見つかりませんでした`);
                    }
                }
            }

            // 見つかったフォントを読み込む
            console.log(`${fonts.length}個のフォントファイルが見つかりました`);
            await loadFontsFromList(fonts, fontsPath);

            return fonts;
        } catch (error) {
            console.error('フォント検出エラー:', error);
            return [];
        }
    }

    // フォントリストからフォントを読み込む関数
    async function loadFontsFromList(fontFiles, basePath = '/fonts/') {
        try {
            const fonts = [];

            for (const fontInfo of fontFiles) {
                try {
                    // fontInfoがオブジェクトの場合と文字列の場合の両方に対応
                    const fontName = typeof fontInfo === 'string' ? fontInfo : fontInfo.name;
                    const fontUrl = typeof fontInfo === 'string' ?
                        `${basePath}${fontInfo}` : (fontInfo.url || `${basePath}${fontInfo.name}`);

                    console.log(`フォント「${fontName}」をリクエスト: ${fontUrl}`);

                    const response = await fetch(fontUrl);
                    if (!response.ok) {
                        console.error(`フォント「${fontName}」の取得に失敗しました: ${response.status} ${response.statusText}`);
                        continue;
                    }

                    const fontData = await response.arrayBuffer();
                    console.log(`フォント「${fontName}」を取得しました (${fontData.byteLength} bytes)`);

                    const displayName = fontName;
                    const name = fontName.replace(/\.(woff2|woff|ttf|otf)$/i, '');

                    // フォントのMIMEタイプを判定
                    let fontMimeType;
                    if (fontName.endsWith('.woff2')) fontMimeType = 'font/woff2';
                    else if (fontName.endsWith('.woff')) fontMimeType = 'font/woff';
                    else if (fontName.endsWith('.ttf')) fontMimeType = 'font/ttf';
                    else if (fontName.endsWith('.otf')) fontMimeType = 'font/opentype';
                    else {
                        console.warn(`未知のフォント形式: ${fontName}`);
                        continue;
                    }

                    // オリジナルのフォント名を保持
                    const fontObj = {
                        originalName: name,
                        displayName,
                        data: fontData,
                        mimeType: fontMimeType
                    };

                    fonts.push(fontObj);

                } catch (err) {
                    console.error(`フォント「${fontInfo.name || fontInfo}」の読み込みエラー:`, err);
                }
            }

            // フォントをページに追加
            if (fonts.length > 0) {
                console.log(`${fonts.length}個のフォントをページに追加します`);
                await addFontsToPage(fonts);
            } else {
                console.warn('フォントを取得できませんでした');
            }

            return fonts;
        } catch (error) {
            console.error('フォントリストのロードエラー:', error);
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
}); 