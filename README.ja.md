# Vibe Notes

ソースファイルやGit履歴に影響を与えることなく、ワークフローに寄り添うプライベートなコードノートを管理できます。個人的なメモ、コードレビュー、AIを活用したコーディングワークフローに最適です。

## 機能

- **ソースファイルを一切変更せずに**任意の行にノートを追加
- ノートは行末に表示されます
- エディターの行番号横（ガター）に**ビジュアルインジケーター**を表示
- **CodeLensボタン**または右クリックメニューで編集/削除
- すべてのノートを閲覧できる**ツリービュー**
- **Markdown形式**で表示
- **`git notes`**にノートをコピー

## クイックスタート

1. **ノートを追加**: 任意の行で右クリック → "Add Vibe Note to Line"（複数行入力用の一時エディターが開きます）
2. **編集/削除**: ノートがある行の上に表示されるCodeLensボタンを使用
3. **全ノートを表示**: アクティビティバーのVibe Notesパネルを開く

## 保存場所

ノートデータは`.notes`フォルダ以下に保存されます。

> [!IMPORTANT]
> `.notes` ディレクトリと `.notes.local.md` ファイルを `.gitignore` に追加してください。

```bash
# .gitignoreに追加
echo "" >> .gitignore
echo "# Vibe Notes" >> .gitignore
echo ".notes/" >> .gitignore
echo ".notes.local.md" >> .gitignore
```

## コマンド

コマンドパレット（Cmd/Ctrl+Shift+P）からアクセス：
- `Vibe Notes: Add Note to Line`
- `Vibe Notes: Open Notes as Markdown`
- `Vibe Notes: Save to Git Notes`

## 使い方のコツ

- ノートは行末に💬として表示されます（ホバーで全文表示）
- 複数行ノートは".."のサフィックス付きで表示
- 一時エディターでCtrl+S / Cmd+Sでノートを保存
- Git Notesでノートを共有: 保存 → `git push --push-notes`

## 動作要件

- VS Code 1.101.0以上

## リリースノート

詳細は[CHANGELOG.md](CHANGELOG.md)をご覧ください。