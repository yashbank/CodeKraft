/**
 * Two Better Auth instances share one database and differ only by host policy
 * (docs/09 §3.4–§3.6): cookie prefix, idle timeout, TOTP availability.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, phoneNumber, twoFactor } from "better-auth/plugins";

import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import { getFlag } from "@/lib/feature-flags";
import * as schema from "../../../drizzle/schema/auth";
import { hashPassword, verifyPassword } from "./hash";
import { afterHook, beforeHook, type AuthHost } from "./hooks";
import { sendAuthMail } from "./mailer";

export const SESSION_IDLE_SECONDS: Record<AuthHost, number> = { site: 60 * 60, admin: 30 * 60 };
export const SESSION_ABSOLUTE_SECONDS: Record<AuthHost, number> = {
  site: 7 * 24 * 3600,
  admin: 12 * 3600,
};
export const COOKIE_PREFIX: Record<AuthHost, string> = { site: "ck", admin: "ckadm" };

export function createAuth(host: AuthHost, opts: { phoneOtp?: boolean } = {}) {
  const env = getEnv();
  const baseURL = host === "admin" ? env.NEXT_PUBLIC_ADMIN_URL : env.BETTER_AUTH_URL;
  const secure = env.APP_ENV === "production" || baseURL.startsWith("https://");
  const phoneOtp = opts.phoneOtp ?? false;

  const plugins = [
    twoFactor({
      issuer: "CodeKraft",
      skipVerificationOnEnable: false,
      backupCodeOptions: { amount: 10 },
      twoFactorCookieMaxAge: 5 * 60,
    }),
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "This password appears in a known data breach. Choose another.",
    }),
    ...(phoneOtp
      ? [
          phoneNumber({
            otpLength: 6,
            expiresIn: 5 * 60,
            allowedAttempts: 5,
            sendOTP: async ({ phoneNumber: to, code }) =>
              sendAuthMail({ kind: "phone_otp", to, code }),
            signUpOnVerification: {
              getTempEmail: (p) => `${p.replace(/\D/g, "")}@phone.codekraft.invalid`,
              getTempName: (p) => p,
            },
          }),
        ]
      : []),
    nextCookies(),
  ];

  return betterAuth({
    appName: "CodeKraft",
    baseURL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.NEXT_PUBLIC_SITE_URL,
      env.NEXT_PUBLIC_ADMIN_URL,
      "https://*.vercel.app",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
      ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
    ].filter((url): url is string => Boolean(url)),
    database: drizzleAdapter(getDb(), { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false, // verification gates checkout/chatbot, not sign-in (D-1201, BR-03)
      autoSignIn: true,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) =>
        sendAuthMail({ kind: "reset_password", to: user.email, url, token }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url, token }) =>
        sendAuthMail({ kind: "verify_email", to: user.email, url, token }),
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ newEmail, url, token }) =>
          sendAuthMail({ kind: "change_email", to: newEmail, url, token }),
      },
      additionalFields: {
        status: { type: "string", required: false, defaultValue: "active", input: false },
        displayCurrency: { type: "string", required: false, defaultValue: "INR", input: false },
        themePref: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_IDLE_SECONDS[host],
      updateAge: 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: COOKIE_PREFIX[host],
      useSecureCookies: secure,
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
      database: { generateId: "uuid" },
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    hooks: { before: beforeHook(host), after: afterHook(host) },
    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;

const cache = new Map<AuthHost, Auth>();

/** Cached per host; phone OTP plugin is registered only while the flag is on (D-1603). */
export async function getAuth(host: AuthHost): Promise<Auth> {
  const phoneOtp = await getFlag("phone_otp");
  const key = `${host}:${phoneOtp ? 1 : 0}` as AuthHost; // keyed by host+flag
  let auth = cache.get(key);
  if (!auth) {
    auth = createAuth(host, { phoneOtp });
    cache.set(key, auth);
  }
  return auth;
}

export function resetAuthCache(): void {
  cache.clear();
}
