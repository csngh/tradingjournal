import crypto from "crypto";

/**
 * One-way scrypt hash of the app's hardcoded unlock password. The plaintext password is never
 * stored anywhere in this codebase. This constant can only be *compared against* by re-hashing
 * a candidate with the same salt, never reversed back into the original password.
 */
const PASSWORD_SALT = "gringotts-vault-9f3c1a7e";
const PASSWORD_HASH =
  "7726d9bf36da7e2b876006fcb447c0ccad20fbf6777e8e03550edf18935687022217beb5f65866d72ca42c0fa8d514f305d0036c88d66c27f70068ce64ef2b4d";

export function verifyPassword(candidate: string): boolean {
  if (!candidate) return false;
  const candidateHash = crypto.scryptSync(candidate, PASSWORD_SALT, 64);
  const storedHash = Buffer.from(PASSWORD_HASH, "hex");
  // timingSafeEqual requires equal-length buffers; scrypt with a fixed keylen always
  // produces one, but guard anyway since a mismatched length would otherwise throw.
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}
