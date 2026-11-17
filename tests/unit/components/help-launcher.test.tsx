import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpLauncher } from "@/components/help/HelpLauncher";
import { HelpMarkdown, parseBlocks } from "@/components/help/markdown";
import { sourceHref } from "@/components/help/paths";
import { normalizeSuggestions } from "@/components/help/suggestions";

const ok = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.onend?.();
  }
  abort() {}
}

async function openPanel() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("help-launcher"));
  await screen.findByTestId("help-panel");
  return user;
}

beforeEach(() => {
  mockFetch(() => ok({ answer: "ok", sources: [], mode: "guide" }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeRecognition.last = null;
});

describe("HelpLauncher", () => {
  it("renders nothing when disabled", () => {
    render(<HelpLauncher helpEnabled={false} />);
    expect(screen.queryByTestId("help-launcher")).toBeNull();
  });

  it("opens, closes with Esc, returns focus to the launcher", async () => {
    render(<HelpLauncher />);
    const user = await openPanel();
    expect(screen.getByRole("dialog", { name: /ask me anything/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("help-panel")).toBeNull());
    expect(screen.getByTestId("help-launcher")).toHaveFocus();
  });

  it('"?" opens when not typing, and is ignored inside inputs', async () => {
    render(
      <>
        <input aria-label="other" />
        <HelpLauncher />
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("other"));
    await user.keyboard("?");
    expect(screen.queryByTestId("help-panel")).toBeNull();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "?" });
    await screen.findByTestId("help-panel");
  });

  it("hides the mic when SpeechRecognition is unsupported", async () => {
    render(<HelpLauncher />);
    await openPanel();
    expect(screen.queryByTestId("help-mic")).toBeNull();
  });

  it("shows the mic and fills the input from speech (interim then final), stop on second tap", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    render(<HelpLauncher />);
    const user = await openPanel();
    const mic = await screen.findByTestId("help-mic");
    await user.click(mic);
    expect(FakeRecognition.last?.lang).toBe("en-IN");
    expect(screen.getByTestId("help-listening")).toBeInTheDocument();
    const { act } = await import("@testing-library/react");
    act(() => {
      FakeRecognition.last?.onresult?.({ results: [[{ transcript: "how do I pay" }]] });
    });
    expect(screen.getByRole("textbox")).toHaveValue("how do I pay");
    await user.click(mic);
    await waitFor(() => expect(screen.queryByTestId("help-listening")).toBeNull());
    expect(screen.getByRole("textbox")).toHaveValue("how do I pay");
  });

  it("shows a friendly message when the microphone is blocked", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    render(<HelpLauncher />);
    const user = await openPanel();
    await user.click(await screen.findByTestId("help-mic"));
    const { act } = await import("@testing-library/react");
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(await screen.findByTestId("help-mic-error")).toHaveTextContent(/blocked/i);
  });

  it("language switch only when hindi is enabled; hi uses hi-IN", async () => {
    const { unmount } = render(<HelpLauncher hindiEnabled={false} />);
    await openPanel();
    expect(screen.queryByRole("group", { name: /language/i })).toBeNull();
    unmount();
    cleanup();
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    render(<HelpLauncher hindiEnabled />);
    const user = await openPanel();
    await user.click(screen.getByRole("button", { name: /हिन्दी/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("कुछ भी पूछिए");
    await user.click(await screen.findByTestId("help-mic"));
    expect(FakeRecognition.last?.lang).toBe("hi-IN");
  });

  it("sends a question, renders the answer with source deep link, copy and feedback", async () => {
    const fetchMock = mockFetch(() =>
      ok({
        answer: "1. Open **Orders**\n2. Pick the order",
        sources: [{ id: "orders-pay", title: "Paying for an order" }],
        mode: "guide",
      }),
    );
    render(<HelpLauncher />);
    const user = await openPanel();
    await user.type(screen.getByRole("textbox"), "pay order{Enter}");
    expect(await screen.findByTestId("help-answer")).toHaveTextContent("Open Orders");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      query: "pay order",
      locale: "en",
    });
    expect(screen.getByRole("link", { name: /paying for an order/i })).toHaveAttribute(
      "href",
      "/account/orders",
    );
    await user.click(screen.getByRole("button", { name: "Helpful" }));
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("counts characters and caps input at 300", async () => {
    render(<HelpLauncher />);
    await openPanel();
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "x".repeat(400) } });
    expect(box).toHaveValue("x".repeat(300));
    expect(screen.getByTestId("help-counter")).toHaveTextContent("300/300");
  });

  it("shows an error with retry, and rate-limit text on 429", async () => {
    let n = 0;
    mockFetch(() =>
      n++ === 0 ? ok({ error: "x" }, 500) : ok({ answer: "fine", sources: [], mode: "guide" }),
    );
    render(<HelpLauncher />);
    const user = await openPanel();
    await user.type(screen.getByRole("textbox"), "hello{Enter}");
    expect(await screen.findByTestId("help-error")).toHaveTextContent(/went wrong/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByTestId("help-answer")).toHaveTextContent("fine");
    expect(screen.queryByTestId("help-error")).toBeNull();
    mockFetch(() => ok({}, 429));
    await user.type(screen.getByRole("textbox"), "again{Enter}");
    expect(await screen.findByTestId("help-error")).toHaveTextContent(/too many/i);
  });

  it("shows the search-only banner when the backend is in search mode", async () => {
    mockFetch(() => ok({ answer: "Closest guide", sources: [], mode: "search" }));
    render(<HelpLauncher />);
    const user = await openPanel();
    await user.type(screen.getByRole("textbox"), "budget{Enter}");
    expect(await screen.findByTestId("help-search-only")).toBeInTheDocument();
  });

  it("disables input when mode is off", async () => {
    mockFetch(() => ok({ answer: "", sources: [], mode: "off" }));
    render(<HelpLauncher />);
    const user = await openPanel();
    await user.type(screen.getByRole("textbox"), "hi{Enter}");
    expect(await screen.findByTestId("help-off")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows an offline state and blocks sending", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<HelpLauncher />);
    const user = await openPanel();
    expect(await screen.findByTestId("help-offline")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "hi{Enter}");
    expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("greets by role and uses suggestion chips", async () => {
    render(<HelpLauncher role="admin" suggestions={{ en: ["Refund an order"], hi: ["x"] }} />);
    const user = await openPanel();
    expect(screen.getByRole("dialog")).toHaveTextContent(/admin/i);
    await user.click(screen.getByRole("button", { name: "Refund an order" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("launcher is fixed-position and does not add flow content (no layout shift)", () => {
    const { container } = render(<HelpLauncher />);
    const btn = screen.getByTestId("help-launcher");
    expect(btn.className).toContain("fixed");
    expect(container.firstElementChild).toBe(btn);
  });
});

describe("markdown-lite", () => {
  it("parses numbered steps, bullets and paragraphs", () => {
    expect(parseBlocks("Intro\n1. a\n2) b\n- c")).toEqual([
      { t: "p", text: "Intro" },
      { t: "ol", items: ["a", "b"] },
      { t: "ul", items: ["c"] },
    ]);
  });

  it("never renders raw HTML and strips external links", () => {
    const { container } = render(
      <HelpMarkdown
        text={
          "<img src=x onerror=alert(1)> [evil](https://evil.test) [ok](/account/orders) [js](javascript:alert(1))"
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/account/orders"]);
    expect(container.textContent).toContain("evil");
  });
});

describe("helpers", () => {
  it("sourceHref prefers a safe path, ignores external, maps ids per area", () => {
    expect(sourceHref({ id: "a", title: "A", path: "/account/invoices" }, "customer")).toBe(
      "/account/invoices",
    );
    expect(sourceHref({ id: "a", title: "A", path: "https://x.test" }, "customer")).toBeNull();
    expect(sourceHref({ id: "a", title: "A", path: "//x.test" }, "customer")).toBeNull();
    expect(sourceHref({ id: "refund-orders", title: "A" }, "admin")).toBe("/orders");
    expect(sourceHref({ id: "zzz", title: "A" }, "admin")).toBeNull();
  });

  it("normalizeSuggestions falls back to defaults and reads role-keyed files", () => {
    expect(normalizeSuggestions(null, "customer").en.length).toBeGreaterThan(0);
    const s = normalizeSuggestions({ admin: { en: ["a"], hi: ["b"] } }, "admin");
    expect(s).toEqual({ en: ["a"], hi: ["b"] });
    expect(normalizeSuggestions(["q"], "customer").en).toEqual(["q"]);
  });
});
