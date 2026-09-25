"use client";

import { WishlistScreen } from "@/components/account/WishlistScreen";
import { wishlist } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

export function Preview({ state }: { state: string }) {
  return (
    <WishlistScreen
      items={state === "empty" ? [] : wishlist}
      links={{ dashboard: DEV_LINKS.purchases }}
      loading={state === "loading"}
    />
  );
}
