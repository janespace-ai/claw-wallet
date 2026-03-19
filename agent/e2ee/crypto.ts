import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { gcm } from "@noble/ciphers/aes.js";

const HKDF_INFO = new TextEncoder().encode("claw-wallet-e2ee-v1");
const NONCE_SIZE = 12;
const MAX_SEQ_GAP = 100;

export interface E2EEKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface E2EESession {
  sharedKey: Uint8Array;
  sendSeq: number;
  recvSeq: number;
  pairId: string;
}

export function generateKeyPair(): E2EEKeyPair {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export function deriveSharedKey(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  const sharedSecret = x25519.getSharedSecret(myPrivateKey, theirPublicKey);
  const derived = hkdf(sha256, sharedSecret, undefined, HKDF_INFO, 32);

  sharedSecret.fill(0);

  return derived;
}

export function createSession(
  sharedKey: Uint8Array,
  pairId: string
): E2EESession {
  return {
    sharedKey: new Uint8Array(sharedKey),
    sendSeq: 0,
    recvSeq: 0,
    pairId,
  };
}

function seqToNonce(seq: number): Uint8Array {
  const nonce = new Uint8Array(NONCE_SIZE);
  const view = new DataView(nonce.buffer);
  view.setUint32(4, Math.floor(seq / 0x100000000), false);
  view.setUint32(8, seq >>> 0, false);
  return nonce;
}

export function encrypt(session: E2EESession, plaintext: Uint8Array): Uint8Array {
  const seq = session.sendSeq++;
  const nonce = seqToNonce(seq);
  const aes = gcm(session.sharedKey, nonce);
  const ciphertext = aes.encrypt(plaintext);

  const envelope = new Uint8Array(4 + ciphertext.length);
  const view = new DataView(envelope.buffer);
  view.setUint32(0, seq, false);
  envelope.set(ciphertext, 4);

  return envelope;
}

export function decrypt(session: E2EESession, envelope: Uint8Array): Uint8Array {
  if (envelope.length < 4) {
    throw new Error("E2EE: envelope too short");
  }

  const view = new DataView(envelope.buffer, envelope.byteOffset);
  const seq = view.getUint32(0, false);

  if (seq <= session.recvSeq && session.recvSeq > 0) {
    throw new Error(`E2EE: duplicate or replayed sequence ${seq} (last: ${session.recvSeq})`);
  }

  if (seq > session.recvSeq + MAX_SEQ_GAP) {
    throw new Error(`E2EE: sequence gap too large ${seq} (last: ${session.recvSeq})`);
  }

  const nonce = seqToNonce(seq);
  const ciphertext = envelope.slice(4);
  const aes = gcm(session.sharedKey, nonce);

  const plaintext = aes.decrypt(ciphertext);
  session.recvSeq = seq;

  return plaintext;
}

export function encryptJSON(session: E2EESession, data: unknown): Uint8Array {
  const json = JSON.stringify(data);
  const plaintext = new TextEncoder().encode(json);
  return encrypt(session, plaintext);
}

export function decryptJSON<T = unknown>(session: E2EESession, envelope: Uint8Array): T {
  const plaintext = decrypt(session, envelope);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as T;
}

export function destroySession(session: E2EESession): void {
  session.sharedKey.fill(0);
  session.sendSeq = 0;
  session.recvSeq = 0;
}
