const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    try {
        // CORSヘッダーを設定
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET'
        };

        // URL パラメータからフォント名を取得
        const fontName = event.path.split('/').pop();
        if (!fontName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'フォント名が指定されていません' })
            };
        }

        // GitHub API用のオクトキットクライアントを初期化
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        // GitHubリポジトリの情報（環境変数から取得）
        const owner = process.env.GITHUB_OWNER || 'リポジトリ所有者を設定してください';
        const repo = process.env.GITHUB_REPO || 'リポジトリ名を設定してください';
        const branch = event.queryStringParameters?.branch || process.env.GITHUB_BRANCH || 'fix-font-display';
        const fontPath = `fonts/${fontName}`;

        console.log(`フォントをリクエスト: ${owner}/${repo}/${branch}/${fontPath}`);

        // ファイル情報を取得
        const fileInfo = await octokit.repos.getContent({
            owner,
            repo,
            path: fontPath,
            ref: branch,
        });

        // ダウンロードURLを取得
        const downloadUrl = fileInfo.data.download_url;
        if (!downloadUrl) {
            throw new Error('フォントのダウンロードURLが見つかりません');
        }

        // フォントファイルをダウンロード
        const fontResponse = await fetch(downloadUrl);
        if (!fontResponse.ok) {
            throw new Error(`フォントのダウンロードに失敗しました: ${fontResponse.status}`);
        }

        // フォントデータをバイナリで取得
        const fontData = await fontResponse.buffer();

        // MIMEタイプを判定
        let contentType;
        if (fontName.endsWith('.woff2')) contentType = 'font/woff2';
        else if (fontName.endsWith('.woff')) contentType = 'font/woff';
        else if (fontName.endsWith('.ttf')) contentType = 'font/ttf';
        else if (fontName.endsWith('.otf')) contentType = 'font/opentype';
        else contentType = 'application/octet-stream';

        // バイナリデータを返す
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': contentType,
                'Content-Length': fontData.length.toString(),
                'Cache-Control': 'public, max-age=31536000' // 1年間のキャッシュ
            },
            body: fontData.toString('base64'),
            isBase64Encoded: true
        };
    } catch (error) {
        console.error('フォント取得エラー:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                error: `フォント取得エラー: ${error.message}`,
                status: error.status,
                details: error.response?.data || {}
            })
        };
    }
}; 