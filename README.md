# Hayonero2 🌙

Hayonero2 は、設定した時間にやさしく「夜更かしをやめましょう」と通知する Discord ボットです。TypeScript と discord.js を使用し、サーバーごとの設定は暗号化して SQLite に保存します。

---

## 目次

- 日本語
- やさしいにほんご
- English
- セットアップ
- セキュリティ
- ライセンス

---

## 日本語

### 概要

Hayonero2 は、サーバー毎に設定した時刻に指定チャンネルへ「夜更かしをやめましょう」と通知する Discord ボットです。ロールやユーザーへのメンション、カスタムメッセージ、スケジュール管理などの機能を提供します。

### 主な機能

- 指定時刻に指定チャンネルへ毎日自動でメッセージを送信
- メンションの ON/OFF と対象（ロール／ユーザー）設定
- サーバーごとのカスタムメッセージと言語設定（日本語／英語）
- スケジュール一覧・無効化・有効化・削除
- 管理コマンドの利用を許可するロール設定
- 設定は AES-256-GCM で暗号化して保存

---

## やさしいにほんご（かんたんにわかる日本語）

Hayonero2 は、よるおそくまで起きている人に、やさしくおしらせするボットです。

なにができるの？

- きめたじかんに、チャットのチャンネルに「やすみましょう」と言います。
- 役割（ロール）や人（ユーザー）をさすことができます。
- メッセージの文を自分の言葉に変えられます。
- スケジュールを見ること、止めること、元に戻すこと、全部消すことができます。

かんたんなつかいかた:

1. このリポジトリをパソコンにコピーします。

```bash
git clone https://github.com/yuki319jp/hayonerobot2.git
cd hayonerobot2
npm install
```

2. .env というファイルをつくります。サンプルをコピーしてつかいます。

```bash
cp .env.example .env
```

3. .env のなかに次を書きます。

- DISCORD_TOKEN — ボットのトークン
- CLIENT_ID — アプリのID
- ENCRYPTION_SECRET — 長いランダムな文字（32文字以上がおすすめ）

4. さいしょにコマンドを登録します。

```bash
npm run register
```

5. ボットをうごかします。

開発: `npm run dev`
本番: `npm run build` そして `npm start`

だいじなこと: ENCRYPTION_SECRET をなくすと、まえの設定がよめなくなります。たいせつにしてください。

---

## English

### Overview

Hayonero2 is a Discord bot that gently reminds users to stop staying up late at a configured time per server. It is implemented in TypeScript using discord.js and stores per-server settings encrypted in SQLite.

### Key features

- Sends scheduled daily warnings to a configured channel
- Optional mentions (role or specific user)
- Per-server custom messages and language (Japanese/English)
- Schedule management: list, disable, enable, delete
- Command-role: allow a role to use admin commands without Manage Server
- Settings encrypted with AES-256-GCM and stored in `data/hayonero2.db`

### Commands (examples)

- `/help` — Show help and command summaries
- `/settings` — Show current server settings
- `/setup` — Configure settings (has modal form option)
- `/channelset`, `/message`, `/mention`, `/schedule`

---

## Setup

1. Clone and install:

```bash
git clone https://github.com/yuki319jp/hayonerobot2.git
cd hayonerobot2
npm install
```

2. Create `.env` from `.env.example` and set required values:

- `DISCORD_TOKEN` — Bot token
- `CLIENT_ID` — App client ID
- `GUILD_ID` — (optional) for dev
- `ENCRYPTION_SECRET` — long random secret (recommended >=32 chars)

3. Register slash commands:

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

## Security

- Key derivation: HKDF-SHA256 with `ENCRYPTION_SECRET` + guild ID to derive per-guild key
- Encryption: AES-256-GCM with random IV and auth tag
- Storage: encrypted payload, IV, and tag stored base64 in SQLite

## License

GPL-3.0

Made by yuki319jp with AI
