"use client";

import { useState } from "react";
import { RegisterScreen, type RegisterState } from "@/components/account/RegisterScreen";
import { authClient } from "@/modules/auth/client";

export default function RegisterPage() {
  const [state, setState] = useState<RegisterState>("default");
  const [sentTo, setSentTo] = useState("");

  const handleSubmit = async (values: { name: string; email: string; password: string }) => {
    setState("loading");
    try {
      const { data, error } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.name,
      });

      if (error) {
        setState("error");
        return;
      }

      setSentTo(values.email);
      setState("sent");
    } catch (err) {
      setState("error");
    }
  };

  return (
    <RegisterScreen
      state={state}
      sentTo={sentTo}
      onSubmit={handleSubmit}
    />
  );
}
