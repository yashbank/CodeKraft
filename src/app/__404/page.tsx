import { notFound } from "next/navigation";

/** Target of the middleware rewrite for /admin/* on the public host (docs/04 §8). */
export default function BlockedAdminPath() {
  notFound();
}
