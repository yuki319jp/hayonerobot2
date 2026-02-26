import { ServerSettings } from '../types';

export type TranslationKey =
  | 'help.title'
  | 'help.description'
  | 'help.setup'
  | 'help.channelset'
  | 'help.message'
  | 'help.mention'
  | 'help.settings'
  | 'setup.success'
  | 'setup.language_set'
  | 'setup.enabled'
  | 'setup.disabled'
  | 'channelset.success'
  | 'channelset.cleared'
  | 'channelset.no_channel'
  | 'message.success'
  | 'message.reset'
  | 'mention.enabled'
  | 'mention.disabled'
  | 'mention.target_set'
  | 'settings.title'
  | 'settings.language'
  | 'settings.status'
  | 'settings.channel'
  | 'settings.mention'
  | 'settings.mention_target'
  | 'settings.warn_time'
  | 'settings.custom_message'
  | 'settings.none'
  | 'settings.on'
  | 'settings.off'
  | 'error.no_permission'
  | 'error.general';

export type Translations = Record<TranslationKey, string>;

const ja: Translations = {
  'help.title': '🌙 Hayonero2 - 夜更かし警告Bot',
  'help.description':
    '設定した時刻になると、指定チャンネルに夜更かし警告メッセージを送信します。',
  'help.setup': '`/setup` — Botの初期設定（言語・有効化）',
  'help.channelset': '`/channelset` — 警告を送るチャンネルを設定',
  'help.message': '`/message` — 警告メッセージをカスタマイズ',
  'help.mention': '`/mention` — メンションのON/OFF・対象設定',
  'help.settings': '`/settings` — 現在の設定を表示',
  'setup.success': '✅ セットアップが完了しました。',
  'setup.language_set': '🌐 言語を **{lang}** に設定しました。',
  'setup.enabled': '✅ 夜更かし警告を **有効** にしました。',
  'setup.disabled': '🔕 夜更かし警告を **無効** にしました。',
  'channelset.success': '✅ 警告チャンネルを {channel} に設定しました。',
  'channelset.cleared': '✅ チャンネル設定をクリアしました。',
  'channelset.no_channel': '⚠️ チャンネルが指定されていません。',
  'message.success': '✅ メッセージを変更しました:\n> {message}',
  'message.reset': '✅ メッセージをデフォルトに戻しました。',
  'mention.enabled': '🔔 メンションを **ON** にしました。',
  'mention.disabled': '🔕 メンションを **OFF** にしました。',
  'mention.target_set': '✅ メンション対象を {target} に設定しました。',
  'settings.title': '⚙️ 現在の設定',
  'settings.language': '言語',
  'settings.status': 'Bot有効',
  'settings.channel': '警告チャンネル',
  'settings.mention': 'メンション',
  'settings.mention_target': 'メンション対象',
  'settings.warn_time': '警告時刻',
  'settings.custom_message': 'カスタムメッセージ',
  'settings.none': '未設定',
  'settings.on': 'ON',
  'settings.off': 'OFF',
  'error.no_permission': '❌ このコマンドはサーバー管理者のみ使用できます。',
  'error.general': '❌ エラーが発生しました。しばらくしてから再試行してください。',
};

const en: Translations = {
  'help.title': '🌙 Hayonero2 - Stay-up-late Warning Bot',
  'help.description':
    'Sends a warning message to the designated channel at the configured time to remind people not to stay up too late.',
  'help.setup': '`/setup` — Initial setup (language, enable/disable)',
  'help.channelset': '`/channelset` — Set the channel for warnings',
  'help.message': '`/message` — Customize the warning message',
  'help.mention': '`/mention` — Toggle mentions on/off and set target',
  'help.settings': '`/settings` — Show current settings',
  'setup.success': '✅ Setup complete.',
  'setup.language_set': '🌐 Language set to **{lang}**.',
  'setup.enabled': '✅ Stay-up-late warnings **enabled**.',
  'setup.disabled': '🔕 Stay-up-late warnings **disabled**.',
  'channelset.success': '✅ Warning channel set to {channel}.',
  'channelset.cleared': '✅ Channel setting cleared.',
  'channelset.no_channel': '⚠️ No channel specified.',
  'message.success': '✅ Message updated:\n> {message}',
  'message.reset': '✅ Message reset to default.',
  'mention.enabled': '🔔 Mentions turned **ON**.',
  'mention.disabled': '🔕 Mentions turned **OFF**.',
  'mention.target_set': '✅ Mention target set to {target}.',
  'settings.title': '⚙️ Current Settings',
  'settings.language': 'Language',
  'settings.status': 'Bot Enabled',
  'settings.channel': 'Warning Channel',
  'settings.mention': 'Mention',
  'settings.mention_target': 'Mention Target',
  'settings.warn_time': 'Warning Time',
  'settings.custom_message': 'Custom Message',
  'settings.none': 'Not set',
  'settings.on': 'ON',
  'settings.off': 'OFF',
  'error.no_permission': '❌ This command is for server administrators only.',
  'error.general': '❌ An error occurred. Please try again later.',
};

const locales: Record<ServerSettings['language'], Translations> = { ja, en };

export function t(
  lang: ServerSettings['language'],
  key: TranslationKey,
  vars: Record<string, string> = {}
): string {
  let str = locales[lang][key] ?? locales['en'][key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

export function defaultMessage(lang: ServerSettings['language']): string {
  if (lang === 'ja') {
    return '🌙 もうこんな時間です！夜更かしは体に毒ですよ。そろそろ寝ましょう！';
  }
  return "🌙 It's getting late! Staying up too late is bad for your health. Time to sleep!";
}
