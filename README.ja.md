# Shadow Comments

ソースファイルやGit履歴に影響を与えることなく、プライベートなコードコメントを管理できます。個人的なメモ、コードレビュー、AIを活用したコーディングワークフローに最適です。

## 機能

- **ソースファイルを一切変更せずに**任意の行にコメントを追加
- コメントは行末に表示されます
- エディターの行番号横（ガター）に**ビジュアルインジケーター**を表示
- **CodeLensボタン**または右クリックメニューで編集/削除
- すべてのコメントを閲覧できる**ツリービュー**
- **Markdown形式**で表示
- **`git notes`**にコメントをコピー

## クイックスタート

1. **コメントを追加**: 任意の行で右クリック → "Add Shadow Comment to Line"（複数行入力用の一時エディターが開きます）
2. **編集/削除**: コメントがある行の上に表示されるCodeLensボタンを使用
3. **全コメントを表示**: アクティビティバーのShadow Commentsパネルを開く

## 保存場所

コメントデータは`.comments`フォルダ以下に保存されます。

> [!IMPORTANT]
> `.comments` ディレクトリを `.gitignore` に追加してください。

## コマンド

コマンドパレット（Cmd/Ctrl+Shift+P）からアクセス：
- `Shadow Comments: Add Comment to Line`
- `Shadow Comments: Open Comments as Markdown`
- `Shadow Comments: Save to Git Notes`

## 使い方のコツ

- コメントは行末に💬として表示されます（ホバーで全文表示）
- 複数行コメントは".."のサフィックス付きで表示
- 一時エディターでCtrl+S / Cmd+Sでコメントを保存
- Git Notesでコメントを共有: 保存 → `git push --push-notes`

## 動作要件

- VS Code 1.101.0 以上

## リリースノート

詳細は[CHANGELOG.md](CHANGELOG.md)をご覧ください。
