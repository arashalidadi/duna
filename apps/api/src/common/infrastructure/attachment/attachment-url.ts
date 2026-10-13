import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed download tokens (DEC-090: no public or unrestricted URLs).
 *
 * A token is issued only after the caller passed the attachment permission checks. It binds the
 * attachment id, the requesting user id and an expiry time, and is HMAC-SHA256 signed with a
 * server-side secret. Format: base64url(JSON payload) + "." + base64url(signature).
 */

export interface AttachmentTokenPayload {
  aid: string;
  uid: string;
  /** Expiry as Unix seconds. */
  exp: number;
}

export type AttachmentTokenError = 'malformed' | 'signature' | 'expired';

export class AttachmentTokenException extends Error {
  constructor(readonly reason: AttachmentTokenError) {
    super(`Attachment token rejected: ${reason}`);
  }
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(encodedPayload).digest();
}

export function signAttachmentToken(payload: AttachmentTokenPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, secret).toString('base64url')}`;
}

export function verifyAttachmentToken(
  token: string,
  secret: string,
  nowSeconds: number
): AttachmentTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw new AttachmentTokenException('malformed');
  }
  const [encodedPayload, encodedSignature] = parts;

  const expected = sign(encodedPayload, secret);
  const actual = Buffer.from(encodedSignature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AttachmentTokenException('signature');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new AttachmentTokenException('malformed');
  }
  if (!isTokenPayload(payload)) {
    throw new AttachmentTokenException('malformed');
  }
  if (payload.exp <= nowSeconds) {
    throw new AttachmentTokenException('expired');
  }
  return payload;
}

function isTokenPayload(value: unknown): value is AttachmentTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.aid === 'string' &&
    typeof candidate.uid === 'string' &&
    typeof candidate.exp === 'number' &&
    Number.isFinite(candidate.exp)
  );
}
