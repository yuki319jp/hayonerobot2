# Copilot Instructions (日本語)

このリポジトリ向けの Copilot スキル集です。日本語話者がVibe Coding（雰囲気を大切にしたコーディング）を行う際に快適に使えるよう、PRレビューを日本語で書く、コミットメッセージを日本語で整える、トーンを指定してコードをレビューする、などのスキルを定義しています。

構成:
- github/skills/<skill>/skill.md : 各スキルの定義と例（copilot_instruction フィールドを含む）

使い方:
1. 該当する skill.md の copilot_instruction をプロンプトとして Copilot に与えてください。
2. 出力のトーンや長さは skill.md の指示に従って調整してください。

スキル一覧:
- github/skills/pr-review/skill.md — PRレビュー（日本語で建設的に書く）
- github/skills/japanese-writing/skill.md — 日本語ライティング（説明文・ドキュメント）
- github/skills/vibe-coding/skill.md — Vibe Coding トーンアシスト（言語化しづらい“雰囲気”の指示を支援）
- github/skills/commit-messages/skill.md — 日本語コミットメッセージ生成

貢献:
スキルを追加・改善したい場合は、該当するフォルダに skill.md を追加し、README に追記してください。
