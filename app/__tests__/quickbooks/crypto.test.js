// AES-256-GCM token encryption round-trip and tamper detection.

import { Encrypt, Decrypt } from "../../src/QuickBooks/Crypto.js";

describe("QuickBooks token crypto", () => {
  it("round-trips tokens", () => {
    const oToken = "AB11570128472xkNguQRcTVGkzYXO0yL7hlA6HpuYCyLDvTZ";
    const oCipher = Encrypt(oToken);
    expect(oCipher).not.toContain(oToken);
    expect(oCipher.split(":")).toHaveLength(3);
    expect(Decrypt(oCipher)).toBe(oToken);
  });

  it("produces a fresh IV for every encryption", () => {
    expect(Encrypt("same")).not.toBe(Encrypt("same"));
  });

  it("passes null through", () => {
    expect(Encrypt(null)).toBeNull();
    expect(Decrypt(null)).toBeNull();
  });

  it("rejects tampered ciphertext", () => {
    const oCipher = Encrypt("secret");
    const oParts = oCipher.split(":");
    const oData = Buffer.from(oParts[2], "base64");
    oData[0] ^= 0xff;
    oParts[2] = oData.toString("base64");
    expect(() => Decrypt(oParts.join(":"))).toThrow();
  });

  it("rejects malformed ciphertext", () => {
    expect(() => Decrypt("not-a-ciphertext")).toThrow(/Invalid ciphertext/);
  });
});
