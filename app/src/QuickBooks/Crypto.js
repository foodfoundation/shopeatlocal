// QuickBooks/Crypto.js
// --------------------
// AES-256-GCM encryption for stored OAuth tokens. Ciphertext format is
// 'iv:tag:data', each part base64.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { TokenKey } from "./Config.js";

function key() {
  if (!/^[0-9a-fA-F]{64}$/.test(TokenKey))
    throw Error("QuickBooksTokenKey must be 64 hex characters (32 bytes).");
  return Buffer.from(TokenKey, "hex");
}

export function Encrypt(aPlain) {
  if (aPlain === null || aPlain === undefined) return null;
  const oIV = randomBytes(12);
  const oCipher = createCipheriv("aes-256-gcm", key(), oIV);
  const oData = Buffer.concat([oCipher.update(String(aPlain), "utf8"), oCipher.final()]);
  const oTag = oCipher.getAuthTag();
  return `${oIV.toString("base64")}:${oTag.toString("base64")}:${oData.toString("base64")}`;
}

export function Decrypt(aCiphertext) {
  if (!aCiphertext) return null;
  const oParts = String(aCiphertext).split(":");
  if (oParts.length !== 3) throw Error("QuickBooks Crypto: Invalid ciphertext format");
  const [oIV, oTag, oData] = oParts.map(o => Buffer.from(o, "base64"));
  const oDecipher = createDecipheriv("aes-256-gcm", key(), oIV);
  oDecipher.setAuthTag(oTag);
  return Buffer.concat([oDecipher.update(oData), oDecipher.final()]).toString("utf8");
}
