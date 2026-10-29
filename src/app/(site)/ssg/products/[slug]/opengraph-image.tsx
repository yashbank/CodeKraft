import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

import Image from "../../../products/[slug]/opengraph-image";

// See ../../opengraph-image.tsx.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default Image;
