"use client";

import { createAuthClient } from "better-auth/react";
import { phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";

/** Browser client; baseURL defaults to the current origin so it works on both hosts. */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [twoFactorClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
