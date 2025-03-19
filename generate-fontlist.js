// generate-fontlist.js
// Netlifyビルド時にfontsディレクトリからフォントリストを生成するスクリプト

const fs = require('fs');
const path = require('path');

// fontsディレクトリのパス
const fontsDir = path.join(__dirname, 'fonts');
// 出力ファイル
const outputFile = path.join(__dirname, 'fontlist.json');

// サポートするフォント拡張子
const supportedExtensions = ['.woff', '.woff2', '.ttf', '.otf'];

try {
    console.log('フォントリスト生成を開始します...');

    // fontsディレクトリの存在確認
    if (!fs.existsSync(fontsDir)) {
        console.log(`fontsディレクトリが見つかりません: ${fontsDir}`);
        console.log('空のフォントリストを生成します');
        fs.writeFileSync(outputFile, '[]');
        process.exit(0);
    }

    // fontsディレクトリの内容を読み取り
    const files = fs.readdirSync(fontsDir);

    // フォントファイルのみをフィルタリング
    const fontFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
    }).map(file => {
        return { name: file };
    });

    console.log(`${fontFiles.length}個のフォントファイルを検出しました`);

    // JSONファイルに保存
    fs.writeFileSync(outputFile, JSON.stringify(fontFiles, null, 2));

    console.log(`フォントリストを生成しました: ${outputFile}`);
} catch (error) {
    console.error('フォントリスト生成エラー:', error);
    process.exit(1);
} 