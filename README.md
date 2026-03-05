# hayonerobot2
Next-generation bot that alerts users staying on Discord late into the night 

---

[Hayonero-Bot](https://github.com/yuki319jp/Hayonero-Bot) のリメイク（再実装）です。初代リポジトリは上記リンクを参照してください。

主な変更点（抜粋）:

- 開発言語を Python から TypeScript に変更
- 日本語／英語の両言語対応を追加
- コマンドをよりシンプルに整理
- その他リファクタリングや実装改善

---

## 日本語

### 概要

Hayonero2 は、サーバー毎に設定した時刻に「夜更かしをやめましょう」とやさしく通知する Discord ボットです。TypeScript と discord.js を使って実装されており、設定は SQLite に AES-256-GCM で暗号化して保存されます。

### 主な機能

- 毎日指定時刻に指定チャンネルへ警告メッセージを送信します。
- メンション機能：オンラインユーザー全員、特定のロール、またはメンションなしから選択可能。
- ユーザーが `/exclude` コマンドで自分をメンション対象から除外可能。
- サーバーごとにカスタムメッセージを設定可能。
- 日本語／英語の応答に対応。
- 設定は暗号化して保存され、ENCRYPTION_SECRET がなければ復号できません。
- **スケジュール管理**: スケジュールの削除・一時無効化・有効化・一覧表示が可能。
- **コマンド実行ロール**: サーバー管理者以外でも指定ロールを持つメンバーが管理コマンドを使用できます。
- **インタラクティブセットアップ**: ボタンやセレクトメニューを使った直感的な設定画面。
- **自動バックアップ**: DB ファイルを定期的にバックアップし、復元も可能。
- **鍵ローテーション**: 暗号化キーを安全に更新（レイジー・バルク両対応）。
- **監査ログ**: 重要操作をコンソール + ファイルへ記録。
- **アラート通知**: 障害を Discord webhook でリアルタイム通知。
- **マルチ DB 対応**: Prisma により SQLite / PostgreSQL / MySQL (MariaDB) を環境変数で切替可能（feature/prisma-multi-db）。

### コマンド（概要）

#### 全員が使用可能なコマンド

- `/help` — ヘルプ（コマンド説明）
- `/schedule list` — スケジュール情報を表示（全員利用可能）
- `/exclude add` — 自分をメンション除外リストに追加
- `/exclude remove` — メンション除外リストから自分を削除
- `/settings` — 現在のサーバー設定を表示

#### 管理者のみが使用可能なコマンド

以下のコマンドは **サーバー管理者権限**（Manage Server）または `/setup` で設定した **コマンド実行ロール** が必要です。

- `/setup` — インタラクティブセットアップ（ボタン・セレクトメニュー操作で設定変更）
  - チャンネル選択
  - メンション対象の設定（オンラインユーザー全員 / ロール / なし）
  - 有効化・無効化
  - 警告時刻・カスタムメッセージの設定
- `/channelset` — 警告を送るチャンネルを設定（空でクリア）
- `/message` — カスタムメッセージの設定またはリセット
- `/mention` — メンション機能の ON/OFF 設定
- `/schedule` — スケジュール管理
  - `list` — 現在のスケジュール情報を表示（全員利用可能）
  - `disable` — スケジュールを一時的に無効化
  - `enable` — スケジュールを再び有効化
  - `delete` — スケジュール設定をすべてリセット

### セットアップ（日本語で詳しく）

1. リポジトリをクローンして依存をインストールします。

```bash
git clone https://github.com/yuki319jp/hayonerobot2.git
cd hayonerobot2
npm install
```

2. 環境ファイルを作成し、必要な値を設定します。

```bash
cp .env.example .env
```

.env に設定する主な値:

- DISCORD_TOKEN — Bot のトークン（Discord Developer Portal）
- CLIENT_ID — アプリケーションのクライアント ID
- GUILD_ID — （開発用、任意）ギルド ID を入れるとそのギルドに即時登録されます
- ENCRYPTION_SECRET — 設定を暗号化するための長いランダム文字列（最低 32 文字以上を推奨）

※ ENCRYPTION_SECRET は非常に重要です。これがなければデータベースの設定を復号できません。紛失や変更は既存データの損失につながります。

3. スラッシュコマンドを登録します（初回のみ）。

```bash
npm run register
```

4. ボットを起動します。

開発モード:

```bash
npm run dev
```

本番:

```bash
npm run build
npm start
```

### 実運用上の注意

- データベースファイル: `data/hayonero2.db` に保存されます（.gitignore に登録済み）。
- ENCRYPTION_SECRET を変更すると既存の暗号化データは復号できなくなるため注意してください。
- Bot に必要な権限（メッセージ送信、チャンネル閲覧、メンションなど）を与えてください。

### セキュリティ（仕組みの詳細）

- 鍵導出: 環境変数 `ENCRYPTION_SECRET` とギルド ID を組み合わせ、HKDF-SHA256 によりギルド毎の 256 ビット鍵を導出します。
- 暗号: AES-256-GCM を使用。書き込みごとにランダム IV を生成し、認証タグを記録します。
- 保存: SQLite に base64 エンコードした暗号文・IV・タグを保存します。
- 起動時バリデーション: `ENCRYPTION_SECRET` の長さ・強度・プレースホルダー検出を自動チェックします。
- 秘密はコードやデータベースに保存しません。`ENCRYPTION_SECRET` は安全に保管してください。

### 鍵ローテーション

ENCRYPTION_SECRET を安全に更新できます。

**レイジーローテーション（ゼロダウンタイム）**

```bash
# 1. 旧シークレットをアーカイブ
ENCRYPTION_SECRET_V1=<現在のENCRYPTION_SECRET>

# 2. 新シークレットに切替
ENCRYPTION_SECRET=<新しいシークレット>
ENCRYPTION_KEY_VERSION=2

# 3. ボット再起動 → レコードへのアクセス時に自動で新しいキーへ再暗号化
```

**バルクローテーション（一括）**

```bash
npm run rotate-keys -- --dry-run   # 事前確認
npm run rotate-keys                # 本番実行（実行前にバックアップを自動作成）
```

### バックアップと復元

```bash
npm run backup                          # 今すぐバックアップを作成
npm run backup -- --list                # バックアップ一覧を表示
npm run backup -- --restore <filename>  # バックアップから復元
```

定期バックアップは起動時に自動でスケジュールされます（デフォルト: 毎日 3:00）。

| 環境変数 | 説明 | デフォルト |
|----------|------|----------|
| `BACKUP_DIR` | バックアップ保存先 | `data/backups` |
| `BACKUP_RETENTION_DAYS` | 保持日数 | `7` |
| `BACKUP_SCHEDULE` | cron 式 | `0 3 * * *` |

### 監査ログ

重要な操作（設定変更、スケジュール操作、除外操作、DB 初期化など）を記録します。

```env
AUDIT_LOG_FILE=logs/audit.jsonl  # JSON Lines 形式（省略時はコンソールのみ）
```

### アラート通知

バックアップ失敗・起動エラー・夜更かし警告送信失敗を Discord webhook で通知します。

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_BOT_NAME=Hayonero2 Alert   # 省略可
```

### マルチ DB 対応（Prisma）

`feature/prisma-multi-db` ブランチで Prisma を使ったマルチ DB 対応を実装しています。

```bash
npm run switch-db sqlite       # SQLite（デフォルト）
npm run switch-db postgresql   # PostgreSQL
npm run switch-db mysql        # MySQL / MariaDB
npm run db:push                # スキーマ適用（SQLite）
npm run db:migrate             # マイグレーション実行（Postgres/MySQL）

# 既存データの移行
npm run db:migrate-data -- --dry-run   # 移行内容をプレビュー
npm run db:migrate-data                # 本番移行
npm run db:verify                      # 移行後の整合性確認
```

### トラブルシューティング

- Bot が起動しない／ログインできない: `DISCORD_TOKEN` が正しいか確認。
- 設定が読み込めない: `ENCRYPTION_SECRET` が設定されているか、長さ（>=32）を確認。
- メッセージが送れない: Bot にチャンネルの Send Messages 権限があるか確認。

---

## English

### Overview

Hayonero2 is a Discord bot that gently warns users not to stay up too late. It runs on TypeScript using discord.js, schedules messages with node-cron, and stores per-server settings in an encrypted SQLite database.

### Features

- Sends a daily warning message at a configured time to a designated text channel.
- **Flexible mention support**: Choose between mentioning all online users, a specific role, or no mention at all.
- **Mention exclusion**: Users can use `/exclude` to opt out of being mentioned in warnings.
- Per-server customizable message and language (Japanese/English).
- Settings are encrypted using AES-256-GCM and stored in `data/hayonero2.db`.
- **Schedule management**: list, temporarily disable, re-enable, or delete the warning schedule.
- **Command role**: designate a role whose members can use admin commands without needing Manage Server permission.
- **Interactive setup**: Configure settings easily using buttons and select menus.

### Commands

#### Available to all users

- `/help` — Display help and command summaries.
- `/settings` — Show current server settings.
- `/schedule list` — Display schedule information (available to everyone).
- `/exclude add` — Add yourself to the mention exclude list.
- `/exclude remove` — Remove yourself from the mention exclude list.

#### Admin-only commands

The following commands require **Manage Server** permission **or** the configured command role (set via admin commands).

- `/setup` — Interactive setup interface with buttons and select menus for easy configuration.
  - Select warning channel
  - Choose mention target (all online users / specific role / none)
  - Enable or disable the bot
  - Set warning time and custom message
- `/channelset` — Set (or clear) the channel that receives warnings.
- `/message` — Set or reset the custom warning message.
- `/mention` — Configure mention settings (enable/disable and target type).
- `/schedule` — Manage schedules:
  - `list` — show schedule info (available to everyone)
  - `disable` — temporarily disable the schedule
  - `enable` — re-enable the schedule
  - `delete` — reset all schedule settings to defaults

### Installation & Configuration

1. Clone and install dependencies:

```bash
git clone https://github.com/yuki319jp/hayonerobot2.git
cd hayonerobot2
npm install
```

2. Create a `.env` from `.env.example` and fill in required values:

- DISCORD_TOKEN — Bot token from the Discord Developer Portal.
- CLIENT_ID — Application client ID (used to register commands).
- GUILD_ID — Optional; provide for immediate guild-specific command registration during development.
- ENCRYPTION_SECRET — Long random secret used to derive per-guild encryption keys (recommended >= 32 characters).

3. Register slash commands (one-time):

```bash
npm run register
```

4. Run the bot:

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

### Operational Notes

- Database path: `data/hayonero2.db` (excluded from git via `.gitignore`).
- Changing `ENCRYPTION_SECRET` will prevent decryption of previously saved settings — treat it as irreversible unless you manage key rotation carefully.
- Make sure the bot has permissions to view and send messages in the configured channel.

### Security Details

- Key derivation: HKDF-SHA256 is used with `ENCRYPTION_SECRET` and the guild ID to derive a unique 256-bit key per guild.
- Encryption: AES-256-GCM with a random IV per write and authenticated tag verification on read.
- Storage: Encrypted payload, IV and auth tag are stored base64-encoded in SQLite; the secret is never stored in the database.

### Troubleshooting

- Bot login failures: check `DISCORD_TOKEN` and that the bot is invited to the guild.
- Settings decryption errors: ensure `ENCRYPTION_SECRET` is set and not truncated; the code checks for minimum length.
- Missing messages: verify channel and bot permissions.

---

License: GPL-3.0
Made by yuki319jp with AI
