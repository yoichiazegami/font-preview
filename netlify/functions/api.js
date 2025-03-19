const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();

// JSONリクエストのパーサー
app.use(express.json());

// CORSヘッダーを追加
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// Netlify Functionsではファイルシステムの読み書きに制限があるため
// 一時的なメモリストレージを使用
const fontStorage = {};

// Netlifyの一時ディレクトリ（読み書き可能）
const TMP_DIR = '/tmp';
const fontsDir = path.join(TMP_DIR, 'fonts');

// 一時ディレクトリを作成
if (!fs.existsSync(fontsDir)) {
    try {
        fs.mkdirSync(fontsDir, { recursive: true });
        console.log('fontsフォルダを作成しました:', fontsDir);

        // ディレクトリのパーミッションを設定
        fs.chmodSync(fontsDir, 0o755);
        console.log('fontsフォルダのパーミッションを設定しました');

        // ディレクトリ作成の確認
        if (fs.existsSync(fontsDir)) {
            const stats = fs.statSync(fontsDir);
            console.log('fontsフォルダの状態:', {
                isDirectory: stats.isDirectory(),
                permissions: stats.mode,
                owner: stats.uid
            });
        }
    } catch (err) {
        console.error('fontsフォルダの作成中にエラーが発生しました:', err);
    }
}

// ファイルアップロードの設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, fontsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

// ファイルフィルタリング
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('許可されていないファイル形式です。'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024  // 10MB
    }
});

// ルートパス
app.get('/', (req, res) => {
    res.json({ message: 'フォント共有APIが動作中です' });
});

// フォント一覧を取得するAPI
app.get('/api/list-fonts', (req, res) => {
    try {
        // ファイルシステム上のフォントファイルを取得
        let fontFiles = [];

        try {
            if (fs.existsSync(fontsDir)) {
                const files = fs.readdirSync(fontsDir).filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.woff', '.woff2', '.ttf', '.otf'].includes(ext);
                });

                fontFiles = files.map(file => {
                    const filePath = path.join(fontsDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        dateAdded: stats.mtime
                    };
                });
            }
        } catch (fsError) {
            console.error('ファイルシステムの読み取りエラー:', fsError);
        }

        // メモリ上のフォントも追加
        const memoryFonts = Object.keys(fontStorage).map(name => ({
            name,
            size: fontStorage[name].data.byteLength,
            dateAdded: fontStorage[name].dateAdded,
            isMemoryStorage: true
        }));

        // 両方のリストを結合
        const allFonts = [...fontFiles, ...memoryFonts.filter(memFont =>
            !fontFiles.some(fsFont => fsFont.name === memFont.name)
        )];

        console.log('検出されたフォントファイル:', allFonts.length);
        res.json(allFonts);
    } catch (error) {
        console.error('フォントリスト取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// フォントファイルをアップロードするAPI
app.post('/api/upload-font', upload.array('fonts', 20), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'ファイルがアップロードされていません' });
        }

        const uploadedFiles = req.files.map(file => {
            // ファイルをメモリにも保存
            try {
                const filePath = path.join(fontsDir, file.originalname);
                const fontData = fs.readFileSync(filePath);

                // ファイルが正しく保存されたことを確認
                if (fontData && fontData.length > 0) {
                    console.log(`フォント「${file.originalname}」をメモリに保存しました (${fontData.length} bytes)`);

                    // ファイルが読み取り可能か確認
                    const fileStats = fs.statSync(filePath);
                    console.log(`フォント「${file.originalname}」の状態:`, {
                        size: fileStats.size,
                        permissions: fileStats.mode,
                        readable: fs.accessSync(filePath, fs.constants.R_OK) === undefined
                    });

                    fontStorage[file.originalname] = {
                        data: fontData,
                        dateAdded: new Date()
                    };
                } else {
                    throw new Error(`ファイル「${file.originalname}」の読み取りに失敗しました (サイズ: 0)`);
                }
            } catch (readError) {
                console.error(`ファイル読み取りエラー: ${file.originalname}`, readError);
            }

            return {
                name: file.originalname,
                size: file.size,
                path: file.path,
                dateAdded: new Date()
            };
        });

        console.log(`${uploadedFiles.length}個のフォントファイルをアップロードしました`);
        res.json({
            message: `${uploadedFiles.length}個のフォントファイルをアップロードしました`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('フォントアップロードエラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// 特定のフォントファイルを取得するAPI
app.get('/api/font/:fontName', (req, res) => {
    try {
        const fontName = req.params.fontName;
        const fontPath = path.join(fontsDir, fontName);

        // ファイルシステムでチェック
        if (fs.existsSync(fontPath)) {
            const ext = path.extname(fontName).toLowerCase();
            let mimeType = 'application/octet-stream';

            // MIMEタイプの設定
            switch (ext) {
                case '.woff2': mimeType = 'font/woff2'; break;
                case '.woff': mimeType = 'font/woff'; break;
                case '.ttf': mimeType = 'font/ttf'; break;
                case '.otf': mimeType = 'font/otf'; break;
            }

            // CORSヘッダーを追加（フォントファイル用）
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

            // キャッシュ設定
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Content-Type', mimeType);

            // ファイルを読み込んでバッファとして送信
            const fontData = fs.readFileSync(fontPath);
            res.send(fontData);
            return;
        }

        // メモリストレージでチェック
        if (fontStorage[fontName]) {
            const ext = path.extname(fontName).toLowerCase();
            let mimeType = 'application/octet-stream';

            // MIMEタイプの設定
            switch (ext) {
                case '.woff2': mimeType = 'font/woff2'; break;
                case '.woff': mimeType = 'font/woff'; break;
                case '.ttf': mimeType = 'font/ttf'; break;
                case '.otf': mimeType = 'font/otf'; break;
            }

            // CORSヘッダーを追加（フォントファイル用）
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

            // キャッシュ設定
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Content-Type', mimeType);

            res.send(Buffer.from(fontStorage[fontName].data));
            return;
        }

        // 見つからない場合
        res.status(404).json({ error: 'フォントファイルが見つかりません' });
    } catch (error) {
        console.error('フォント取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// フォントファイルを削除するAPI
app.delete('/api/font/:fontName', (req, res) => {
    try {
        const fontName = req.params.fontName;
        const fontPath = path.join(fontsDir, fontName);
        let deleted = false;

        // ファイルシステムから削除
        if (fs.existsSync(fontPath)) {
            fs.unlinkSync(fontPath);
            deleted = true;
        }

        // メモリからも削除
        if (fontStorage[fontName]) {
            delete fontStorage[fontName];
            deleted = true;
        }

        if (deleted) {
            console.log(`フォントファイル「${fontName}」を削除しました`);
            res.json({ message: `フォントファイル「${fontName}」を削除しました` });
        } else {
            res.status(404).json({ error: 'フォントファイルが見つかりません' });
        }
    } catch (error) {
        console.error('フォント削除エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// 404ハンドラー
app.use((req, res) => {
    res.status(404).json({ error: 'リクエストされたリソースが見つかりません' });
});

// エラーハンドラー
app.use((err, req, res, next) => {
    console.error('APIエラー:', err);
    res.status(500).json({ error: err.message || 'サーバーエラーが発生しました' });
});

// サーバーレス関数としてエクスポート
module.exports.handler = serverless(app); 