"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { RegisterScreen, type RegisterState } from "@/components/account/RegisterScreen";
import { authClient } from "@/modules/auth/client";

const ALREADY_EXISTS_MESSAGE: ReactNode = (
  <>
    An account with this email already exists —{" "}
    <Link href="/auth/login" className="font-medium underline">
      sign in
    </Link>{" "}
    or{" "}
    <Link href="/auth/reset" className="font-medium underline">
      reset your password
    </Link>
    .
  </>
);

export default function RegisterPage() {
  const [state, setState] = useState<RegisterState>("default");
  const [sentTo, setSentTo] = useState("");
  const [errorMessage, setErrorMessage] = useState<ReactNode>(null);

  const handleSubmit = async (values: { name: string; email: string; password: string }) => {
    setState("loading");
    try {
      const { error } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.name,
      });

      if (error) {
        setErrorMessage(
          error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? ALREADY_EXISTS_MESSAGE
            : (error.message ?? "Something went wrong. Please try again."),
        );
        setState("error");
        return;
      }

      setSentTo(values.email);
      setState("sent");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setState("error");
    }
  };

  const handleGoogleClick = () => {
    void authClient.signIn.social({ provider: "google", callbackURL: "/account" });
  };

  return (
    <RegisterScreen
      state={state}
      sentTo={sentTo}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
      onGoogleClick={handleGoogleClick}
    />
  );
}
