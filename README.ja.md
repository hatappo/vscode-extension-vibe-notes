# Vibe Notes

ソースファイルやGit履歴に影響を与えることなく、ワークフローに寄り添うプライベートなコードノートを管理できます。個人的なメモ、コードレビュー、AIを活用したコーディングワークフローに最適です。

## 機能

- **ソースファイルを一切変更せずに**任意の行にノートを追加
- **General Notes**でプロジェクト全体のノートを管理（特定のファイルに紐付かない）
- ノートは行末に💬アイコンとして表示
- エディターの行番号横（ガター）に**ビジュアルインジケーター**を表示
- **CodeLensボタン**または右クリックメニューで編集/削除
- ファイルとプロジェクト別にすべてのノートを閲覧できる**ツリービュー**
- カスタマイズ可能な**Markdown形式**でエクスポート
- **LLM向けコピー**でAIフレンドリーな形式に変換
- **`git notes`**にノートを保存してチームで共有

## クイックスタート

1. **ノートを追加**: 任意の行で右クリック → "Add Vibe Note to Line"（複数行入力用の一時エディターが開きます）
2. **編集/削除**: ノートがある行の上に表示されるCodeLensボタンを使用
3. **全ノートを表示**: アクティビティバーのVibe Notesパネルを開く
4. **General Notes**: "Open as Markdown" → `## /` セクションでノートを追加
5. **AI向けコピー**: ツリービューのツールバーの "Copy for LLM" ボタンでAIフレンドリーな形式に

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
- `Vibe Notes: Add Note to Line` - 現在の行にノートを追加
- `Vibe Notes: Edit Note at Cursor` - 既存のノートを編集
- `Vibe Notes: Delete Note at Cursor` - 既存のノートを削除
- `Vibe Notes: Open Notes as Markdown` - すべてのノートをマークダウン形式で表示/編集
- `Vibe Notes: Copy for LLM` - ノートをAIフレンドリーな形式でコピー
- `Vibe Notes: Save to Git Notes` - ノートをgit notesにエクスポート
- `Vibe Notes: Append to Git Notes` - 既存のgit notesにノートを追記
- `Vibe Notes: Refresh Tree` - ノートのツリービューを更新

## 使い方のコツ

- ノートは行末に💬として表示されます（ホバーで全文表示）
- 複数行ノートは".."のサフィックス付きで表示
- 一時エディターでCtrl+S / Cmd+Sでノートを保存
- Git Notesでノートを共有: 保存 → `git push origin refs/notes/commits`
- General Notes（`## /`）はTODO、プロジェクトドキュメント、ファイル間メモに最適

## 設定

利用可能な設定:
- `vibe-notes.showMarkdownPreamble` - マークダウンファイルの説明ヘッダーの表示/非表示（デフォルト: true）
- `vibe-notes.copyForLLM.defaultPrompt` - LLMコピー機能のデフォルトプロンプト
- `vibe-notes.copyForLLM.includeCode` - LLM向けコピー時にコードスニペットを含める（デフォルト: false）
- `vibe-notes.editorSplitMode` - ノート編集時のエディター分割方法（none/horizontal/vertical、デフォルト: horizontal）

## 動作要件

- VS Code 1.101.0以上

## ロードマップ

今後開発予定の機能:

- **Diff表示対応** - Git diffビューやVSCodeの比較ビューでのノート表示・追加
- **セマンティックベースのノート紐付け** - 行番号ではなくコード要素（クラス、メソッド、関数）にノートを関連付け、リファクタリング時も追従
- **Git Notesインポート** - 既存のgit notesをVibe Notes形式にインポート、シームレスな移行とチーム連携を実現
- **Git Appraise連携** - コードレビューワークフローのため[git-appraise](https://github.com/google/git-appraise)互換のJSON形式でエクスポート
- **カスタムLLMプロンプトテンプレート** - ユーザー定義可能なLLMプロンプト生成フォーマット、カスタマイズされた出力構造に対応

## リリースノート

詳細は[CHANGELOG.md](CHANGELOG.md)をご覧ください。