/**
 * Monitoring and alerting service for Hayonero2.
 *
 * Sends critical alert messages to a Discord webhook when important errors
 * occur (backup failures, DB errors, startup failures, etc.).
 *
 * Configuration:
 *   ALERT_WEBHOOK_URL  - Discord webhook URL (required to enable alerts)
 *   ALERT_BOT_NAME     - Sender name shown in the webhook message (default: "Hayonero2 Alert")
 *
 * If ALERT_WEBHOOK_URL is not set, all alerts are logged to console only.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

const SEVERITY_COLOR: Record<AlertSeverity, number> = {
  info:     0x5865f2, // Discord blurple
  warning:  0xfee75c, // yellow
  error:    0xed4245, // red
  critical: 0xeb459e, // magenta
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info:     'ℹ️',
  warning:  '⚠️',
  error:    '❌',
  critical: '🚨',
};

export interface AlertOptions {
  severity?: AlertSeverity;
  title?: string;
  detail?: string;
  /** Bot name shown in the Discord webhook message */
  username?: string;
}

/**
 * Sends an alert message to the configured Discord webhook.
 * Falls back to console output if the webhook is not configured or fails.
 *
 * This function never throws — all errors are caught and logged.
 */
export async function sendAlert(message: string, options: AlertOptions = {}): Promise<void> {
  const severity = options.severity ?? 'error';
  const emoji = SEVERITY_EMOJI[severity];
  const fullMessage = `${emoji} **${options.title ?? 'Alert'}**: ${message}`;

  // Always log to console
  console.error(`[Monitor] [${severity.toUpperCase()}] ${options.title ?? 'Alert'}: ${message}`);
  if (options.detail) {
    console.error(`[Monitor] Detail: ${options.detail}`);
  }

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return; // webhook not configured

  const username = options.username
    ?? process.env.ALERT_BOT_NAME
    ?? 'Hayonero2 Alert';

  const payload = JSON.stringify({
    username,
    embeds: [
      {
        description: fullMessage + (options.detail ? `\n\`\`\`\n${options.detail.slice(0, 1000)}\n\`\`\`` : ''),
        color: SEVERITY_COLOR[severity],
        timestamp: new Date().toISOString(),
      },
    ],
  });

  try {
    await postWebhook(webhookUrl, payload);
  } catch (err) {
    console.error('[Monitor] Failed to send webhook alert:', err);
  }
}

function postWebhook(urlStr: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return reject(new Error(`Invalid ALERT_WEBHOOK_URL: ${urlStr}`));
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      // Drain response to free socket
      res.resume();
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Webhook HTTP ${res.statusCode}`));
        } else {
          resolve();
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Webhook request timed out'));
    });
    req.write(body);
    req.end();
  });
}
