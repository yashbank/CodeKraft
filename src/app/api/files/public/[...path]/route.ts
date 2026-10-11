import { NextResponse } from "next/server";
import { getStorageDriver, getPublicBucketName } from "@/lib/storage";

export async function GET(
  _req: Request,
  props: { params: Promise<{ path: string[] }> },
) {
  const { path } = await props.params;
  const objectKey = path.join("/");
  const storage = getStorageDriver();
  const bucket = getPublicBucketName();

  try {
    const { body, contentType, contentLength } = await storage.getObject(
      bucket,
      objectKey,
    );
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
