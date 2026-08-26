import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// ─── ANSI colour helpers ──────────────────────────────────────────────────────
// NOTE: upgraded to 256-colour codes (\x1b[38;5;Nm) for a richer, more
// "colorful" palette than the basic 16-colour set — oranges, pinks, purples,
// teals etc. Falls back gracefully on any modern terminal.
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  white: '\x1b[97m',
  gray: '\x1b[90m',
  black: '\x1b[30m',

  cyan: '\x1b[38;5;51m',
  teal: '\x1b[38;5;44m',
  green: '\x1b[38;5;46m',
  lime: '\x1b[38;5;118m',
  yellow: '\x1b[38;5;220m',
  gold: '\x1b[38;5;214m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[38;5;196m',
  rose: '\x1b[38;5;204m',
  pink: '\x1b[38;5;213m',
  magenta: '\x1b[38;5;201m',
  purple: '\x1b[38;5;135m',
  violet: '\x1b[38;5;99m',
  blue: '\x1b[38;5;39m',
  skyblue: '\x1b[38;5;75m',

  bgRed: '\x1b[48;5;196m',
  bgOrange: '\x1b[48;5;208m',
  bgYellow: '\x1b[48;5;220m',
  bgGreen: '\x1b[48;5;46m',
  bgTeal: '\x1b[48;5;30m',
  bgBlue: '\x1b[48;5;33m',
  bgPurple: '\x1b[48;5;99m',
  bgPink: '\x1b[48;5;205m',
  bgGray: '\x1b[100m',
};

const paint = (...parts: string[]): string => parts.join('') + c.reset;

// ─── Method badge colours (each verb gets its own distinct hue) ──────────────
const METHOD_STYLES: Record<string, string> = {
  GET: paint(c.bgBlue, c.bold, c.white),
  POST: paint(c.bgGreen, c.bold, c.black),
  PUT: paint(c.bgYellow, c.bold, c.black),
  PATCH: paint(c.bgOrange, c.bold, c.black),
  DELETE: paint(c.bgRed, c.bold, c.white),
  OPTIONS: paint(c.bgPurple, c.bold, c.white),
  HEAD: paint(c.bgGray, c.bold, c.white),
};

// Rotating rainbow palette used for the payload section headers so
// Params / Query / Body / Response each get their own consistent colour.
const SECTION_COLORS: Record<string, string> = {
  Params: c.skyblue,
  Query: c.teal,
  Body: c.pink,
  Response: c.gold,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusStyle(code: number): string {
  if (code >= 500) return paint(c.bold, c.red);
  if (code >= 400) return paint(c.bold, c.orange);
  if (code >= 300) return paint(c.bold, c.cyan);
  return paint(c.bold, c.green);
}

function levelTag(code: number): string {
  if (code >= 500) return paint(c.bgRed, c.bold, c.white, ' ERROR ');
  if (code >= 400) return paint(c.bgYellow, c.bold, c.black, '  WARN ');
  return paint(c.bgGreen, c.bold, c.black, '  INFO ');
}

function durationStyle(ms: number): string {
  if (ms > 2000) return paint(c.bold, c.red, `${ms}ms`);
  if (ms > 500) return paint(c.bold, c.gold, `${ms}ms`);
  return paint(c.bold, c.lime, `${ms}ms`);
}

function formatTimestamp(date: Date = new Date()): string {
  const d = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
  const t = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${d}, ${t}`;
}

function formatUserAgent(rawUa: string | null): string | null {
  if (!rawUa) return null;
  const ua = rawUa.toLowerCase();

  // Tools & Clients
  if (ua.includes('postman')) return 'Postman';
  if (ua.includes('insomnia')) return 'Insomnia';
  if (ua.includes('dart') || ua.includes('flutter')) return 'Flutter / Dart';
  if (ua.includes('curl')) return 'cURL';
  if (ua.includes('axios')) return 'Axios';
  if (ua.includes('swagger')) return 'Swagger UI';

  // Browsers
  let browser = '';
  if (ua.includes('edg') || ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opr') || ua.includes('opera')) browser = 'Opera';
  else if (
    ua.includes('chrome') ||
    ua.includes('chromium') ||
    ua.includes('crios')
  )
    browser = 'Chrome';
  else if (ua.includes('firefox') || ua.includes('fxios')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('mozilla')) browser = 'Browser';

  // OS
  let os = '';
  if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios'))
    os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';

  if (browser && os) return `${browser} (${os})`;
  if (browser) return browser;
  if (os) return `${os} Client`;

  return rawUa.length > 20 ? rawUa.slice(0, 20) + '…' : rawUa;
}

function writeLog(level: 'info' | 'warn' | 'error', line: string): void {
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

function inlinePayload(value: unknown, color: string, indent = 2): string {
  const json = JSON.stringify(value, null, indent);
  if (!json || json === '{}' || json === '[]' || json === 'null') return '';
  return json
    .split('\n')
    .map((l) => paint(color, '  ' + l))
    .join('\n');
}

// A gradient-ish separator instead of a flat grey line
function rainbowSep(width = 72): string {
  const hues = [c.violet, c.blue, c.teal, c.green, c.gold, c.orange, c.rose];
  const chunk = Math.ceil(width / hues.length);
  return hues.map((h) => paint(h, '─'.repeat(chunk))).join('').slice(0, width);
}

// ─── Field type ───────────────────────────────────────────────────────────────
interface LogFields {
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  userId: string | null;
  userType: string | null;
  query: unknown;
  params: unknown;
  body: unknown;
  response: unknown;
  responseSize: string | null;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  // ─── Sensitive keys ─────────────────────────────────────────────────────────
  private readonly sensitiveKeys = new Set([
    'password',
    'new_password',
    'old_password',
    'token',
    'authorization',
    'access_token',
    'refresh_token',
    'otp',
    'secret',
    'cvv',
    'card_number',
    'ssn',
    'pin',
  ]);

  // ─── Skip config ────────────────────────────────────────────────────────────
  // NOTE: added a few more noisy local-dev paths (swagger assets, static files)
  private readonly skipPrefixes = [
    '/api/docs',
    '/public',
    '/storage',
    '/assets',
    '/favicon',
  ];
  private readonly skipExact = new Set(['/health', '/favicon.ico']);

  // ─── Array cap config ───────────────────────────────────────────────────────
  // NOTE: prevents one bulk-fetch / seed-data response from blowing up the log
  private readonly maxArrayItems = 15;

  // ─── Large response warning threshold (bytes) ──────────────────────────────
  private readonly largeResponseThreshold = 50 * 1024; // 50 KB

  private shouldSkip(path: string): boolean {
    if (this.skipExact.has(path)) return true;
    return this.skipPrefixes.some((prefix) => path.startsWith(prefix));
  }

  // ─── Mask sensitive data (+ cap arrays) ─────────────────────────────────────
  private mask(value: unknown, depth = 0): unknown {
    if (depth > 4 || value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      if (value.length > this.maxArrayItems) {
        const truncated = value
          .slice(0, this.maxArrayItems)
          .map((item) => this.mask(item, depth + 1));
        return [
          ...truncated,
          `…[+${value.length - this.maxArrayItems} more items]`,
        ];
      }
      return value.map((item) => this.mask(item, depth + 1));
    }

    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.sensitiveKeys.has(k.toLowerCase())
          ? '•••'
          : this.mask(v, depth + 1);
      }
      return out;
    }

    if (typeof value === 'string' && value.length > 800) {
      return `${value.slice(0, 800)}…[+${value.length - 800} chars]`;
    }

    return value;
  }

  // ─── Safely normalize response body ────────────────────────────────────────
  // Buffer/string responses need to be parsed before mask() can walk them,
  // otherwise Object.entries() on a Buffer produces garbled output.
  private normalizeResponseBody(body: unknown): unknown {
    if (body === undefined || body === null) return null;

    if (Buffer.isBuffer(body)) {
      return `[Buffer ${body.length} bytes]`;
    }

    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body.length > 800
          ? `${body.slice(0, 800)}…[+${body.length - 800} chars]`
          : body;
      }
    }

    return body;
  }

  // ─── Production: single structured JSON line ─────────────────────────────
  private structuredPayload(fields: LogFields): string {
    return JSON.stringify({
      ...fields,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Development: pretty coloured block ──────────────────────────────────
  private prettyBlock(fields: LogFields): string {
    const methodBadge =
      (METHOD_STYLES[fields.method] ?? paint(c.bold, c.white)) +
      ` ${fields.method.padEnd(7)}` +
      c.reset;

    const header = [
      levelTag(fields.statusCode),
      methodBadge,
      paint(c.bold, c.white, fields.path),
      paint(c.violet, '→'),
      statusStyle(fields.statusCode) + fields.statusCode + c.reset,
      durationStyle(fields.durationMs),
      paint(c.gray, '│'),
      paint(c.dim, c.skyblue, fields.timestamp),
      paint(c.dim, c.purple, `[${fields.requestId.slice(0, 8)}]`),
    ].join(' ');

    const lines: string[] = [rainbowSep(), header];

    // meta row — each field gets its own accent colour
    const meta: string[] = [];
    if (fields.userId) {
      meta.push(
        paint(c.magenta, `👤 ${fields.userId}`) +
          paint(c.gray, ` (${fields.userType ?? 'unknown'})`),
      );
    }
    if (fields.ip) meta.push(paint(c.teal, `🌐 ${fields.ip}`));
    if (fields.responseSize)
      meta.push(paint(c.dim, c.gold, `📦 ${fields.responseSize}`));
    if (fields.userAgent) {
      const shortUa = formatUserAgent(fields.userAgent);
      if (shortUa) {
        meta.push(paint(c.dim, c.pink, `🔧 ${shortUa}`));
      }
    }
    if (meta.length) {
      lines.push('  ' + meta.join(paint(c.dim, c.gray, '  ·  ')));
    }

    // large-response dev hint
    if (
      fields.responseSize &&
      parseInt(fields.responseSize, 10) > this.largeResponseThreshold
    ) {
      lines.push(
        paint(
          c.bold,
          c.orange,
          `  ⚠ large response (${fields.responseSize}) — consider pagination/lazy loading`,
        ),
      );
    }

    // payload sections — each label rendered in its own colour, and each
    // section's JSON body is tinted to match its label instead of a flat grey.
    const sections: [string, unknown][] = [
      ['Params', fields.params],
      ['Query', fields.query],
      ['Body', fields.body],
      ['Response', fields.response],
    ];

    for (const [label, data] of sections) {
      if (data === null || data === undefined) continue;
      if (
        typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data as object).length === 0
      )
        continue;
      const color = SECTION_COLORS[label] ?? c.gray;
      const rendered = inlinePayload(data, color);
      if (rendered) {
        lines.push(paint(c.bold, color, `  ┌── ${label}`));
        lines.push(rendered);
      }
    }

    return lines.join('\n');
  }

  // ─── Main middleware ──────────────────────────────────────────────────────
  use(req: Request & { user?: any }, res: Response, next: NextFunction): void {
    if (this.shouldSkip(req.path)) {
      return next();
    }

    const startedAt = Date.now();
    let capturedBody: unknown;

    const _json = res.json.bind(res);
    const _send = res.send.bind(res);

    res.json = function (body?: unknown) {
      capturedBody = body;
      return _json(body);
    } as typeof res.json;

    res.send = function (body?: unknown) {
      if (capturedBody === undefined) {
        capturedBody = body;
      }
      return _send(body);
    } as typeof res.send;

    // ─── Request ID ────────────────────────────────────────────────────────
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // ─── Emit log on finish ────────────────────────────────────────────────
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const statusCode = res.statusCode;
      const level: 'info' | 'warn' | 'error' =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      const isError = statusCode >= 400;

      const userId = req.user?.userId ?? req.user?.id ?? null;
      const userType = req.user?.email ?? null;

      // req.ip is deprecated in Express 5 — use req.socket directly
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        null;

      // content-length header can be string | string[] | number
      const rawSize = res.getHeader('content-length');
      const responseSize = rawSize != null ? `${String(rawSize)} B` : null;

      // ─── Conditional response logging ───────────────────────────────────
      // Only log the FULL response body for error responses. For successful
      // (2xx/3xx) responses we just keep a short size note — this is the
      // single biggest source of log bloat in the original middleware.
      const responseField = isError
        ? this.mask(this.normalizeResponseBody(capturedBody))
        : responseSize
          ? `[ok, ${responseSize}]`
          : null;

      // Body is usually small, but skip logging an empty object noise-free
      const bodyField =
        req.body && Object.keys(req.body).length ? this.mask(req.body) : null;

      const fields: LogFields = {
        level,
        timestamp: formatTimestamp(new Date()),
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        durationMs,
        ip,
        userAgent: req.get('user-agent') ?? null,
        userId,
        userType,
        query: this.mask(req.query),
        params: this.mask(req.params),
        body: bodyField,
        response: responseField,
        responseSize,
      };

      writeLog(
        level,
        process.env.NODE_ENV === 'production'
          ? this.structuredPayload(fields)
          : this.prettyBlock(fields),
      );
    });

    next();
  }
}