/**
 * Dev-only target for presigned URLs minted by `LocalFsStorageDriver` (src/lib/storage-local.ts).
 * PUT stores the uploaded bytes; GET serves them. Both require a valid HMAC signature and are
 * disabled whenever the active storage driver is not the local one (i.e. in production).
 */
import { NextResponse } from "next/server";

import { getStorageDriver } from "@/lib/storage";
import { LocalFsStorageDriver, verifyLocalUrl } from "@/lib/storage-local";

function parse(req: Request) {
  const u = new URL(req.url);
  return {
    bucket: u.searchParams.get("bucket") ?? "",
    key: u.searchParams.get("key") ?? "",
    exp: Number(u.searchParams.get("exp")),
    sig: u.searchParams.get("sig") ?? "",
  };
}

function localDriver(): LocalFsStorageDriver | null {
  const d = getStorageDriver();
  return d instanceof LocalFsStorageDriver ? d : null;
}

export async function PUT(req: Request) {
  const driver = localDriver();
  if (!driver) return new NextResponse(null, { status: 404 });
  const { bucket, key, exp, sig } = parse(req);
  if (!verifyLocalUrl("put", bucket, key, exp, sig)) {
    return new NextResponse(null, { status: 403 });
  }
  const body = Buffer.from(await req.arrayBuffer());
  await driver.putObject(
    bucket,
    key,
    body,
    req.headers.get("content-type") ?? "application/octet-stream",
  );
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  const driver = localDriver();
  if (!driver) return new NextResponse(null, { status: 404 });
  const { bucket, key, exp, sig } = parse(req);
  if (!verifyLocalUrl("get", bucket, key, exp, sig)) {
    return new NextResponse(null, { status: 403 });
  }
  try {
    const { body, contentType, contentLength } = await driver.getObject(bucket, key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: { "Content-Type": contentType, "Content-Length": String(contentLength) },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
