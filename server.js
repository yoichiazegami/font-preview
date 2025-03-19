const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// 静的ファイルの提供
app.use(express.static('./'));

// fontsフォルダ内のフォントファイルを一覧取得するAPI
app.get('/api/list-fonts', (req, res) => {
    const fontsDir = path.join(__dirname, 'fonts');

    try {
        // フォルダが存在するか確認
        if (!fs.existsSync(fontsDir)) {
            console.log('fontsフォルダが見つかりません');
            return res.json([]);
        }

        // フォルダ内のファイル一覧を取得
        const files = fs.readdirSync(fontsDir).filter(file => {
            // フォントファイルの拡張子のみをフィルタリング
            const ext = path.extname(file).toLowerCase();
            return ['.woff', '.woff2', '.ttf', '.otf'].includes(ext);
        });

        console.log('検出されたフォントファイル:', files);
        res.json(files);
    } catch (error) {
        console.error('フォントファイル一覧の取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// サーバー起動
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
}); 