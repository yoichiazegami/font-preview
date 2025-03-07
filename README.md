# フォントプレビュー

複数のフォントを試し打ちできるシンプルなウェブアプリケーションです。

## 機能

- 様々なシステムフォントからフォントを選択
- カスタムウェブフォント（fontsフォルダ内）の使用
- フォントサイズの調整（8px〜72px）
- フォントの太さの切り替え（標準・太字）
- 字間の調整（-2px〜100px）
- 行間の調整（0.8〜100）
- テキストの編集（プレビュー領域は編集可能）
- ローカルフォントの検出と使用（対応ブラウザのみ）

## 使い方

1. `index.html` をブラウザで開きます
2. 上部のコントロールパネルでフォント、サイズ、太さを選択します
3. プレビュー領域にテキストを入力して、選択したフォントでの表示を確認できます

## ウェブフォントについて

アプリケーションは `fonts` フォルダ内のウェブフォントを自動的に読み込みます。現在、以下のフォントが含まれています：

- 手書きフォント1 (MyHandwrittenFont)
- 手書きフォント2 (MyHandwrittenFont80)
- 手書きフォント3 (MyHandwrittenFont446737)

新しいウェブフォントを追加するには：

1. `.woff2`、`.woff`、`.ttf` などのウェブフォント形式のファイルを `fonts` フォルダに配置します
2. `styles.css` ファイルに新しい `@font-face` 定義を追加します
3. `index.html` のフォント選択リストに新しいオプションを追加します

## ローカルフォント検出について

この機能は実験的で、すべてのブラウザで動作するわけではありません。対応しているブラウザでは、「ローカルフォントを検出」ボタンが表示され、クリックするとシステムにインストールされているフォントを検出して追加します。

## デプロイ方法

このアプリケーションは静的なウェブサイトなので、様々な無料ホスティングサービスを使用してデプロイできます。以下に主な方法を紹介します：

### GitHub Pages

1. GitHubアカウントを作成し、新しいリポジトリを作成します
2. プロジェクトのファイルをリポジトリにプッシュします
3. リポジトリの「Settings」→「Pages」を開きます
4. ソースとして「main」ブランチを選択し、「Save」をクリックします
5. 数分後、GitHubがデプロイURLを提供します（通常は `https://ユーザー名.github.io/リポジトリ名/`）

### Netlify

1. [Netlify](https://www.netlify.com/)にアカウントを作成します
2. 「Sites」→「New site from Git」をクリックします
3. GitHubなどのリポジトリプロバイダーを選択し、プロジェクトのリポジトリを選択します
4. デプロイ設定を確認し、「Deploy site」をクリックします
5. 数分後、NetlifyがデプロイURLを提供します

### Vercel

1. [Vercel](https://vercel.com/)にアカウントを作成します
2. 「New Project」をクリックします
3. GitHubなどのリポジトリプロバイダーからプロジェクトのリポジトリをインポートします
4. デプロイ設定を確認し、「Deploy」をクリックします
5. 数分後、VercelがデプロイURLを提供します

### Firebase Hosting

1. [Firebase](https://firebase.google.com/)にアカウントを作成します
2. 新しいプロジェクトを作成します
3. Firebase CLIをインストールします: `npm install -g firebase-tools`
4. ターミナルで以下のコマンドを実行します：
   ```
   firebase login
   firebase init hosting
   firebase deploy
   ```
5. デプロイが完了すると、FirebaseがデプロイURLを提供します

## 技術仕様

- HTML5
- CSS3
- JavaScript（ES6+）
- Local Font Access API（実験的機能）

## ライセンス

MIT 