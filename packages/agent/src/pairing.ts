// Pairing between the server and the Android app (docs/DESIGN.md §7, stage 6 security).
// One random 32-byte key, created by the server in a git-ignored file and copied into the app's private storage
// over adb (tools/android/pair.mjs). Every API exchange is sealed with AES-256-GCM under that key, so a program that
// takes port 8787 on the phone can neither read what the app sends nor answer it, and nothing else on the phone or
// the PC can use the API without the key. Format: base64(iv[12] | ciphertext | tag[16]), AAD "wellness-v1".
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const AAD = Buffer.from('wellness-v1');
export const DEFAULT_KEY_FILE = fileURLToPath(new URL('../../../.pairing-key', import.meta.url));

export function loadOrCreateKey(path = process.env.PAIRING_KEY_FILE ?? DEFAULT_KEY_FILE): Buffer {
  if (!existsSync(path)) {
    writeFileSync(path, randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
    try { chmodSync(path, 0o600); } catch { /* Windows: ACLs, not modes */ }
  }
  const hex = readFileSync(path, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`pairing key file is not 64 hex characters: ${path}`);
  return Buffer.from(hex, 'hex');
}

export function seal(key: Buffer, value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}

// Throws on a wrong key, a changed byte or a malformed message.
export function open(key: Buffer, text: string): any {
  const buf = Buffer.from(text.trim(), 'base64');
  if (buf.length < 29) throw new Error('sealed message too short');
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAAD(AAD);
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString('utf8'));
}
