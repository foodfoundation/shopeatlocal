// Password Cryptography Module
// -------------------------
// @see {@link https://www.npmjs.com/package/bcryptjs}

import cryptojs from "crypto-js";
import bcryptjs from "bcryptjs";

const { genSalt, hashSync, compare } = bcryptjs;
const { MD5 } = cryptojs;

/** Maximum password length */
export const LenMaxPass = 50;

/** Generates bcrypt hash with salt
 *  @param {string} aPass - Password to hash
 *  @returns {Promise<string>} Hashed password
 */
export async function wHash(aPass) {
  const oCtRoundSalt = 10;
  const oSalt = await genSalt(oCtRoundSalt);
  return hashSync(aPass, oSalt);
}

/** Validates password against bcrypt hash
 *  @param {string} aPass - Password to verify
 *  @param {string} aHashPass - Stored hash
 *  @returns {Promise<boolean>} True if password matches hash
 */
export async function wComp(aPass, aHashPass) {
  if (!aPass || !aHashPass) return Promise.resolve(false);
  return compare(aPass, aHashPass);
}

/** Validates password against legacy MD5 hash
 *  @param {string} aPass - Password to verify
 *  @param {string} aHashPass - Stored MD5 hash
 *  @returns {boolean} True if password matches hash
 */
export function CompLeg(aPass, aHashPass) {
  const oHashMD5 = MD5(aPass).toString();
  return oHashMD5 === aHashPass;
}
