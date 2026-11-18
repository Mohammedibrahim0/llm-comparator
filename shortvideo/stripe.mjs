// تكامل Stripe: إنشاء جلسات الدفع والتحقق من توقيع الـ webhook بدون أي حزم خارجية.
import crypto from 'node:crypto';

const API = 'https://api.stripe.com/v1';

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeCurrency() {
  return (process.env.PAYMENT_CURRENCY || 'sar').toLowerCase();
}

function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripeRequest(path, params = {}, method = 'POST') {
  const headers = {Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`};
  let body;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encode(params).toString();
  }
  const response = await fetch(`${API}${path}`, {method, headers, body});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'stripe_error');
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export function verifyWebhookSignature(payload, signatureHeader, secret) {
  const parts = {};
  for (const chunk of String(signatureHeader || '').split(',')) {
    const [key, value] = chunk.split('=');
    if (key && value) parts[key] = value;
  }
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex');
  if (expected.length !== parts.v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
