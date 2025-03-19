const { Octokit } = require('@octokit/rest');

exports.handler = async function (event, context) {
    try {
        // CORSヘッダーを設定
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET'
        };

        // GitHub API用のオクトキットクライアントを初期化
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        // GitHubリポジトリの情報（環境変数から取得）
        const owner = process.env.GITHUB_OWNER || 'リポジトリ所有者を設定してください';
        const repo = process.env.GITHUB_REPO || 'リポジトリ名を設定してください';
        const branch = event.queryStringParameters?.branch || process.env.GITHUB_BRANCH || 'fix-font-display';
        const fontsDir = 'fonts';

        console.log(`Githubリポジトリから情報を取得: ${owner}/${repo}/${branch}/${fontsDir}`);

        // リポジトリのfontsディレクトリの内容を取得
        const response = await octokit.repos.getContent({
            owner,
            repo,
            path: fontsDir,
            ref: branch,
        });

        // fontsディレクトリのファイルだけをフィルタリング
        const fontFiles = Array.isArray(response.data)
            ? response.data
                .filter(item =>
                    item.type === 'file' &&
                    /\.(woff2|woff|ttf|otf)$/i.test(item.name)
                )
                .map(item => ({
                    name: item.name,
                    path: item.path,
                    download_url: item.download_url,
                    sha: item.sha,
                    size: item.size
                }))
            : [];

        console.log(`${fontFiles.length}個のフォントファイルが見つかりました`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(fontFiles)
        };
    } catch (error) {
        console.error('GitHub APIエラー:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                error: `フォントリスト取得エラー: ${error.message}`,
                status: error.status,
                details: error.response?.data || {}
            })
        };
    }
}; 