"use client";

/**
 * Last-resort boundary: replaces the root layout, so it is self-contained (no theme tokens, no
 * providers, inline styles) and prints no error details.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B10",
          color: "#F2F3F7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <main>
          <p style={{ opacity: 0.6, letterSpacing: 2 }}>500</p>
          <h1>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>The site hit an unexpected error. It has been logged.</p>
          {error.digest ? <p style={{ opacity: 0.7 }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{ padding: "10px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}
          >
            Try again
          </button>{" "}
          {/* global-error replaces the root layout: a plain link is the safe choice here */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "inherit", marginLeft: 12 }}>
            Go home
          </a>
        </main>
      </body>
    </html>
  );
}
