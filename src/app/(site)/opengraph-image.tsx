import { OG_CONTENT_TYPE, OG_SIZE, safeOg } from "@/lib/og-image";
import { getSiteName } from "@/lib/site-brand";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default async function Image() {
  return safeOg(await getSiteName(), "Software studio & digital products");
}
