import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

import Image from "../opengraph-image";

// The ISR twin needs its own file so its metadata carries og:image (middleware lets only these
// image routes through /ssg).
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default Image;
