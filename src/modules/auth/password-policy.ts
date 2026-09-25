/** docs/09 §3.2 password policy. Composition rules are intentionally absent (NIST 800-63B). */
export const PASSWORD_MIN = 12;
export const PASSWORD_MIN_ADMIN = 14;
export const PASSWORD_MAX = 128;

export interface PasswordContext {
  email?: string | null;
  isAdmin?: boolean;
}

export type PasswordPolicyError = "too_short" | "too_long" | "contains_email" | "whitespace_only";

export function validatePassword(
  password: string,
  ctx: PasswordContext = {},
): PasswordPolicyError | null {
  const min = ctx.isAdmin ? PASSWORD_MIN_ADMIN : PASSWORD_MIN;
  if (password.trim().length === 0) return "whitespace_only";
  if (password.length < min) return "too_short";
  if (password.length > PASSWORD_MAX) return "too_long";
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) return "contains_email";
  return null;
}

export function passwordPolicyMessage(err: PasswordPolicyError, ctx: PasswordContext = {}): string {
  switch (err) {
    case "too_short":
      return `Password must be at least ${ctx.isAdmin ? PASSWORD_MIN_ADMIN : PASSWORD_MIN} characters.`;
    case "too_long":
      return `Password must be at most ${PASSWORD_MAX} characters.`;
    case "contains_email":
      return "Password must not contain your email address.";
    case "whitespace_only":
      return "Password cannot be blank.";
  }
}
