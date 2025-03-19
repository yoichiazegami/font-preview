const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3000;

// JSONリクエストのパーサー
app.use(express.json());

// 静的ファイルの提供
app.use(express.static('./'));

// fontsフォルダがなければ作成
const fontsDir = path.join(__dirname, 'fonts');
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    console.log('fontsフォルダを作成しました');
}

// ファイルアップロードの設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'fonts/');
    },
    filename: function (req, file, cb) {
        // オリジナルのファイル名を維持
        cb(null, file.originalname);
    }
});

// ファイルフィルタリング（フォントファイルのみ許可）
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
        fileSize: 10 * 1024 * 1024 // 10MB制限
    }
});

// フォント一覧を取得するAPI
app.get('/api/list-fonts', (req, res) => {
    try {
        // フォルダ内のファイル一覧を取得
        const files = fs.readdirSync(fontsDir).filter(file => {
            // フォントファイルの拡張子のみをフィルタリング
            const ext = path.extname(file).toLowerCase();
            return ['.woff', '.woff2', '.ttf', '.otf'].includes(ext);
        });

        // ファイル情報を取得
        const fontFiles = files.map(file => {
            const filePath = path.join(fontsDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                dateAdded: stats.mtime
            };
        });

        console.log('検出されたフォントファイル:', files.length);
        res.json(fontFiles);
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

        const uploadedFiles = req.files.map(file => ({
            name: file.originalname,
            size: file.size,
            path: file.path,
            dateAdded: new Date()
        }));

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

        if (!fs.existsSync(fontPath)) {
            return res.status(404).json({ error: 'フォントファイルが見つかりません' });
        }

        // MIMEタイプの設定
        const ext = path.extname(fontName).toLowerCase();
        let mimeType;
        switch (ext) {
            case '.woff2':
                mimeType = 'font/woff2';
                break;
            case '.woff':
                mimeType = 'font/woff';
                break;
            case '.ttf':
                mimeType = 'font/ttf';
                break;
            case '.otf':
                mimeType = 'font/otf';
                break;
            default:
                mimeType = 'application/octet-stream';
        }

        res.setHeader('Content-Type', mimeType);
        fs.createReadStream(fontPath).pipe(res);
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

        if (!fs.existsSync(fontPath)) {
            return res.status(404).json({ error: 'フォントファイルが見つかりません' });
        }

        fs.unlinkSync(fontPath);
        console.log(`フォントファイル「${fontName}」を削除しました`);
        res.json({ message: `フォントファイル「${fontName}」を削除しました` });
    } catch (error) {
        console.error('フォント削除エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// サーバー起動
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
}); 