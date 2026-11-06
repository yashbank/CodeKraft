# R2 storage: CORS, media host and upload formats

This page is a setup guide. It does not describe the state of any live bucket: check the bucket
settings yourself after following it.

## Why this is needed

Admin uploads (landing pages, blog, case studies, product media) go straight from the browser to
the storage bucket with a short-lived signed PUT link. Browsers only allow that when the bucket
says the site is allowed to talk to it. That permission is the bucket's CORS policy. Without it
the admin sees "Upload couldn't reach storage" (the browser console says "CORS").

Two buckets matter:

- Public bucket (`R2_BUCKET_PUBLIC`): images, video, audio, fonts and files that show on the site.
- Private bucket (`R2_BUCKET_PRIVATE`): customer files and downloads, served only through the app.

Apply the same CORS policy to both. (The private bucket only needs it for admin uploads.)

## Step 1: bucket CORS JSON

Cloudflare dashboard, R2, pick the bucket, Settings, CORS Policy, Edit, paste this, save.
Replace the example origins with your real ones. Use the exact values of these env vars, with no
trailing slash:

- `NEXT_PUBLIC_SITE_URL` (the public site, for example `https://www.example.com`)
- `NEXT_PUBLIC_ADMIN_URL` (the admin host, for example `https://admin.example.com`)

```json
[
  {
    "AllowedOrigins": [
      "https://www.example.com",
      "https://admin.example.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length", "Content-MD5"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Notes:

- Origins must match exactly: scheme, host and port. `https://example.com` and
  `https://www.example.com` are different origins; list each one you really use.
- For local testing only, add `http://localhost:3000` and `http://admin.localhost:3000` to a
  development bucket. Do not put them in the production bucket.
- `PUT` is the upload. `GET` and `HEAD` let pages read images, play video/audio and load fonts
  from the media host. `ETag` is exposed so the browser can read the upload receipt.
- If the browser console still names a blocked request header, add that header name to
  `AllowedHeaders` and save again.

## Step 2: the media host (`NEXT_PUBLIC_MEDIA_BASE_URL`)

Public files should be served from a normal web address, not the raw R2 storage address.

1. Cloudflare dashboard, R2, the public bucket, Settings, Public access, Custom Domains, connect a
   domain such as `media.example.com`. (The `r2.dev` address also works for testing only.)
2. In the hosting settings (Vercel project, Environment Variables) set
   `NEXT_PUBLIC_MEDIA_BASE_URL=https://media.example.com` for the environment, then redeploy.
   Use the address without a trailing slash. Do not use the `*.r2.cloudflarestorage.com` address:
   the app ignores it and falls back to its own `/api/files/public` route.
3. Make sure the CORS policy from Step 1 is also on the bucket behind that domain.

What the app does with that variable:

- Content Security Policy: the media host is allowed in `img-src`, `media-src` (video and audio),
  `font-src` and `connect-src`. The R2 upload address (`https://*.r2.cloudflarestorage.com`) is
  allowed in `connect-src` for the signed PUT. See `buildCsp` in `src/middleware.ts`.
- Next image: the media host is added to `images.remotePatterns` in `next.config.ts`.
  SVG files are served through the optimizer as a locked-down download.

## Formats the app accepts

One shared list: `src/lib/upload-formats.ts`. Per-purpose rules: `UPLOAD_RULES` in
`src/modules/media/types.ts`.

Landing pages, blog, case studies and logos (`content_media`, public bucket):

| Group | Formats | Size limit |
|-------|---------|------------|
| Images | jpg, png, webp, gif, avif | 10 MB |
| SVG | svg (checked, see below) | 1 MB |
| Video | mp4, webm, mov | 200 MB |
| Audio | mp3, wav, ogg, m4a, flac | 50 MB |
| Documents | pdf | 25 MB |
| Office | docx, xlsx, pptx, doc, xls, ppt | 25 MB |
| Archives | zip, gz, tar, 7z | 100 MB |
| Text | txt, csv, json, md | 5 MB |
| Fonts | woff, woff2, ttf, otf | 10 MB |

Never accepted: html, htm, js, mjs, exe, dll, so, sh, bat, php, py, jar and similar. Every upload is
also checked after it lands: the server reads the first bytes of the file and refuses it when they
do not match the declared type.

SVG rule: SVG is accepted for site content only (not avatars, logos for invoices, product images or
chat). After upload the server reads the whole file and rejects it if it contains scripts, event
handlers (onload and similar), foreignObject, iframes, entities, `@import`, or any link to something
outside the file. A rejected SVG is deleted from the bucket. The file is never rewritten.

## Check it works (after you apply the steps)

1. Open the admin, a landing page, upload a small png. It should finish without an error.
2. Upload a short mp4: it should play on the page.
3. In the browser DevTools Network tab, the PUT to the storage address should return 200 and the
   preflight (OPTIONS) should return 200 or 204. If it fails with "CORS", re-check Step 1.
