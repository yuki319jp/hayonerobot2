# Hayonero2 🌙

このプロジェクトは [Hayonero-Bot](https://github.com/yuki319jp/Hayonero-Bot) のリメイク（再実装）です。初代リポジトリは上記リンクを参照してください。

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
- メンションを ON/OFF でき、ロールまたはユーザーを指定できます（ロール優先）。
- サーバーごとにカスタムメッセージを設定可能。
- 日本語／英語の応答に対応。
- 設定は暗号化して保存され、ENCRYPTION_SECRET がなければ復号できません。
- **スケジュール管理**: スケジュールの削除・一時無効化・有効化・一覧表示が可能。
- **コマンド実行ロール**: サーバー管理者以外でも指定ロールを持つメンバーが管理コマンドを使用できます。
- **セットアップフォーム**: `/setup form:true` でモーダルフォームを使って一度に全設定を行えます。

### コマンド（概要）

- `/help` — ヘルプ（コマンド説明）
- `/settings` — 現在のサーバー設定を表示
- `/setup` — 初期設定（言語、ON/OFF、警告時刻、チャンネル、ロール等すべて設定可）
  - `form:true` オプション → モーダルフォームで対話的に設定
  - `language` / `enabled` / `warn_hour` / `warn_minute` — 基本設定
  - `channel` — 警告チャンネルをここで設定可能
  - `allowed_role` / `clear_allowed_role` — 管理コマンド実行ロールの設定
  - `mention_enabled` / `mention_role` / `mention_user` — メンション設定
- `/channelset` — 警告を送るチャンネルを設定（空でクリア）
- `/message` — カスタムメッセージの設定またはリセット
- `/mention` — メンションの ON/OFF と対象（ロール/ユーザー）設定
- `/schedule` — スケジュール管理
  - `list` — 現在のスケジュール情報を表示（全員利用可能）
  - `disable` — スケジュールを一時的に無効化
  - `enable` — スケジュールを再び有効化
  - `delete` — スケジュール設定をすべてリセット

各コマンドはサーバー管理者権限（Manage Server）または `/setup` で設定した **コマンド実行ロール** が必要です（`/schedule list` は全員利用可能）。

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
- 秘密はコードやデータベースに保存しません。`ENCRYPTION_SECRET` は安全に保管してください。

### トラブルシューティング

- Bot が起動しない／ログインできない: `DISCORD_TOKEN` が正しいか確認。
- 設定が読み込めない: `ENCRYPTION_SECRET` が設定されているか、長さ（>=32）を確認。
- メッセージが送れない: Bot にチャンネルの Send Messages 権限があるか確認。

---

## English

### Overview
Hayonero2 is a Discord bot that gently warns users not to stay up too late. It runs on TypeScript using discord.js, schedules messages with node-cron, and stores per-server settings in an encrypted SQLite database.

### Features (detailed)

- Sends a daily warning message at a configured time to a designated text channel.
- Optional mention support: you can enable mentions and target either a role or a specific user (role takes precedence).
- Per-server customizable message and language (Japanese/English).
- Settings are encrypted using AES-256-GCM and stored in `data/hayonero2.db`.
- **Schedule management**: list, delete, temporarily disable, or re-enable the warning schedule.
- **Command role**: designate a role whose members can use admin commands without needing Manage Server permission.
- **Setup form**: run `/setup form:true` to configure everything at once via a modal form.

### Commands

- `/help` — Display help and command summaries.
- `/settings` — Show current server settings (includes command role).
- `/setup` — Configure all major settings in one command:
  - `form:true` option → opens a modal form for interactive setup
  - `language` / `enabled` / `warn_hour` / `warn_minute` — basic settings
  - `channel` — set warning channel directly in setup
  - `allowed_role` / `clear_allowed_role` — set/clear the command role
  - `mention_enabled` / `mention_role` / `mention_user` — mention settings
- `/channelset` — Set (or clear) the channel that receives warnings.
- `/message` — Set or reset the custom warning message.
- `/mention` — Enable/disable mentions and set the mention target (role/user).
- `/schedule` — Manage schedules:
  - `list` — show schedule info (available to everyone)
  - `disable` — temporarily disable the schedule
  - `enable` — re-enable the schedule
  - `delete` — reset all schedule settings to defaults

Admin commands require Manage Server permission **or** the configured command role (set via `/setup allowed_role`). `/schedule list` is available to all members.

### Installation & configuration

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

### Operational notes

- Database path: `data/hayonero2.db` (excluded from git via `.gitignore`).
- Changing `ENCRYPTION_SECRET` will prevent decryption of previously saved settings — treat it as irreversible unless you manage key rotation carefully.
- Make sure the bot has permissions to view and send messages in the configured channel.

### Security details

- Key derivation: HKDF-SHA256 is used with `ENCRYPTION_SECRET` and the guild ID to derive a unique 256-bit key per guild.
- Encryption: AES-256-GCM with a random IV per write and authenticated tag verification on read.
- Storage: Encrypted payload, IV and auth tag are stored base64-encoded in SQLite; the secret is never stored in the database.

### Troubleshooting

- Bot login failures: check `DISCORD_TOKEN` and that the bot is invited to the guild.
- Settings decryption errors: ensure `ENCRYPTION_SECRET` is set and not truncated; the code checks for minimum length.
- Missing messages: verify channel and bot permissions.

---

License: GNU Public License 3.0