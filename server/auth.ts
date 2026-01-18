import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { User } from "@shared/schema";

const scrypt = promisify(_scrypt);

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function sanitizeUser(user: User): Omit<User, "password"> {
  const { password, ...rest } = user;
  return rest;
}
