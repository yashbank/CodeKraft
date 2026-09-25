/** argon2id (m=64 MiB, t=3, p=1) per docs/09 §3.2 / MASTER_SPEC §7 "Password hashing". */
import argon2 from "argon2";

const OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTS);
}

export async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  if (!data.hash.startsWith("$argon2id$")) return false;
  try {
    return await argon2.verify(data.hash, data.password);
  } catch {
    return false;
  }
}
