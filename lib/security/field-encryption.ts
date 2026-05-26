import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const SECRET_PREFIX = 'enc.v1';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PRIMARY_KEY_SALT = 'denari-plaid-token';
const LEGACY_KEY_SALT = ['led', 'ge-plaid-token'].join('');

function deriveKeys() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be configured to encrypt Plaid secrets.');
  }

  return [PRIMARY_KEY_SALT, LEGACY_KEY_SALT].map((salt) =>
    createHash('sha256').update(`${salt}:${clientId}:${secret}`).digest()
  );
}

function isEncryptedValue(value: string) {
  return value.startsWith(`${SECRET_PREFIX}.`);
}

export function encryptSensitiveValue(value: string) {
  if (!value || isEncryptedValue(value)) {
    return value;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deriveKeys()[0], iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSensitiveValue(value: string) {
  if (!value || !isEncryptedValue(value)) {
    return value;
  }

  const [, ivValue, authTagValue, encryptedValue] = value.split('.');
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Invalid encrypted value format.');
  }

  for (const key of deriveKeys()) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivValue, 'base64url'),
        { authTagLength: AUTH_TAG_LENGTH }
      );
      decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      continue;
    }
  }

  throw new Error('Unable to decrypt sensitive value with configured Plaid credentials.');
}