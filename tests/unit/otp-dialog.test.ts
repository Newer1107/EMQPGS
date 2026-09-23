import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// The repository uses the Node test environment without a DOM renderer. Exercise
// the component's rendered event handlers with persistent hooks and effect cleanup.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  cleanups: new Map<number, () => void>(),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = value; }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useCallback(callback: unknown) { hooks.cursor++; return callback; },
  useEffect(effect: () => (() => void) | void, dependencies: unknown[]) {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as unknown[] | undefined;
    if (previous && dependencies.every((value, i) => Object.is(value, previous[i]))) return;
    hooks.slots[index] = dependencies;
    hooks.effects.push(() => {
      hooks.cleanups.get(index)?.();
      hooks.cleanups.delete(index);
      const cleanup = effect();
      if (cleanup) hooks.cleanups.set(index, cleanup);
    });
  },
}));

import { OtpDialog } from "@/components/auth/otp-dialog";
import { CSRF_COOKIE } from "@/lib/constants";

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node && typeof node === "object" && "props" in node) return text((node as Element).props.children as ReactNode);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

describe("OtpDialog API wiring", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let props: Parameters<typeof OtpDialog>[0];
  let tree: ReactNode;
  function render() {
    hooks.cursor = 0;
    tree = OtpDialog(props);
    hooks.effects.splice(0).forEach((effect) => effect());
  }
  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
    render();
  }
  function click(label: string) {
    const button = elements(tree).find((element) => typeof element.props.onClick === "function" && text(element.props.children as ReactNode) === label);
    expect(button, `button ${label}`).toBeDefined();
    (button!.props.onClick as () => void)();
    render();
  }
  function paste(code = "123456") {
    const target = elements(tree).find((element) => typeof element.props.onPaste === "function");
    expect(target).toBeDefined();
    (target!.props.onPaste as (event: unknown) => void)({ preventDefault: vi.fn(), clipboardData: { getData: () => code } });
  }
  function respond(data: unknown, status = 200) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), { status }));
  }
  function requested() {
    respond({ success: true, data: { expiresAt: new Date(Date.now() + 60_000).toISOString() } });
  }
  async function start() { requested(); render(); await settle(); }

  beforeEach(() => {
    vi.useFakeTimers();
    hooks.slots = [];
    hooks.effects = [];
    hooks.cleanups.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: `${CSRF_COOKIE}=test-token` });
    props = { purpose: "COE_DOWNLOAD", resourceId: "paper-123", email: "person@example.com", onVerified: vi.fn(), onCancel: vi.fn() };
  });
  afterEach(() => {
    hooks.cleanups.forEach((cleanup) => cleanup());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requests a resource-bound code using session credentials and CSRF, and uses server expiry", async () => {
    await start();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/otp/request");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(init?.headers).get("x-csrf-token")).toBe("test-token");
    expect(JSON.parse(init!.body as string)).toEqual({ purpose: "COE_DOWNLOAD", resourceId: "paper-123" });
    expect(text(tree)).toContain("p***@example.com");
    expect(elements(tree).filter((element) => element.type === "input")).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(60_000);
    render();
    expect(text(tree)).toContain("Code expired");
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it("waits for explicit server verification and suppresses duplicate submissions", async () => {
    await start();
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    paste(); paste();
    await settle();
    expect(text(tree)).toContain("Verifying code");
    expect(props.onVerified).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/otp/verify");
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ purpose: "COE_DOWNLOAD", resourceId: "paper-123", code: "123456" });
    resolve(new Response(JSON.stringify({ success: true, data: { verified: true } })));
    await settle();
    expect(props.onVerified).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain("Verified successfully");
  });

  it("submits digit entry to the server only when all six digits are present", async () => {
    await start();
    respond({ success: true, data: { verified: true } });
    for (let index = 0; index < 6; index++) {
      const input = elements(tree).filter((element) => element.type === "input")[index];
      (input.props.onChange as (event: unknown) => void)({ target: { value: String(index) } });
      render();
      if (index < 5) expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    await settle();
    expect(props.onVerified).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "OTP_INVALID", "Invalid OTP code."],
    [401, "OTP_EXPIRED", "Code expired"],
    [429, "OTP_RATE_LIMITED", "Too many attempts"],
    [409, "OTP_REPLAYED", "OTP already used"],
    [401, "UNAUTHORIZED", "Session expired"],
    [403, "FORBIDDEN", "Invalid CSRF token"],
    [500, "INTERNAL_ERROR", "Server unavailable"],
  ])("fails closed for %s %s", async (status, code, message) => {
    await start();
    respond({ success: false, error: { code, message } }, status);
    paste(); await settle();
    expect(text(tree)).toContain(message);
    expect(text(tree)).not.toContain("remaining");
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it.each([
    { success: true, data: { verified: false } },
    { success: true, data: { verified: "true" } },
    { success: true, data: {} },
    { data: { verified: true } },
    null,
  ])("rejects malformed or unconfirmed success: %j", async (body) => {
    await start(); respond(body); paste(); await settle();
    expect(props.onVerified).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Try Again");
  });

  it("does not convert an HTTP failure with a success body into verification", async () => {
    await start(); respond({ success: true, data: { verified: true } }, 500);
    paste(); await settle();
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it("retries invalid codes without sending another and resends through the request API", async () => {
    await start();
    respond({ success: false, error: { code: "OTP_INVALID", message: "Invalid code" } }, 401);
    paste(); await settle(); click("Try Again");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elements(tree).filter((element) => element.type === "input").every((element) => element.props.value === "")).toBe(true);
    requested(); click("Resend"); await settle();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/auth/otp/request");
  });

  it("shows request/network failures and retries the request", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(); await settle();
    expect(text(tree)).toContain("Unable to reach the server");
    expect(elements(tree).filter((element) => element.type === "input")).toHaveLength(0);
    requested(); click("Try Again"); await settle();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/otp/request");
  });

  it("rejects invalid request expiry and non-JSON verification responses", async () => {
    respond({ success: true, data: { expiresAt: "bad" } }); render(); await settle();
    expect(text(tree)).toContain("Invalid OTP response");
    requested(); click("Request New Code"); await settle();
    fetchMock.mockResolvedValueOnce(new Response("not JSON")); paste(); await settle();
    expect(props.onVerified).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Try Again");
  });

  it.each(["cancel", "unmount", "resource change"])("ignores late verification after %s", async (action) => {
    await start();
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    paste(); await settle();
    const signal = fetchMock.mock.calls[1][1]!.signal!;
    if (action === "cancel") (elements(tree)[0].props.onClick as () => void)();
    if (action === "unmount") hooks.cleanups.forEach((cleanup) => cleanup());
    if (action === "resource change") {
      requested(); props = { ...props, resourceId: "paper-456" }; render();
    }
    expect(signal.aborted).toBe(true);
    resolve(new Response(JSON.stringify({ success: true, data: { verified: true } })));
    await settle();
    expect(props.onVerified).not.toHaveBeenCalled();
    if (action === "cancel") expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it("does not resend when the parent replaces callbacks", async () => {
    await start(); props = { ...props, onVerified: vi.fn() }; render(); await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("acquires CSRF when absent and omits an unspecified resource", async () => {
    vi.stubGlobal("document", { cookie: "" });
    props = { ...props, resourceId: undefined };
    respond({ success: true, data: { csrfToken: "fresh-token" } });
    await start();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/csrf");
    const [, init] = fetchMock.mock.calls[1];
    expect(new Headers(init?.headers).get("x-csrf-token")).toBe("fresh-token");
    expect(JSON.parse(init!.body as string)).toEqual({ purpose: "COE_DOWNLOAD" });
  });

  it("fails closed on a verification network error", async () => {
    await start(); fetchMock.mockRejectedValueOnce(new Error("offline"));
    paste(); await settle();
    expect(props.onVerified).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Unable to reach the server");
  });

  it("requires a successful request before exposing code entry", async () => {
    respond({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } }, 403);
    render(); await settle();
    expect(text(tree)).toContain("Not authorized");
    expect(elements(tree).filter((element) => element.type === "input")).toHaveLength(0);
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it("ignores a stale request response after the resource changes", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(); await settle();
    requested(); props = { ...props, resourceId: "paper-456" }; render(); await settle();
    resolve(new Response(JSON.stringify({ success: false, error: { message: "Stale error" } }), { status: 500 }));
    await settle();
    expect(text(tree)).not.toContain("Stale error");
    expect(elements(tree).filter((element) => element.type === "input")).toHaveLength(6);
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
});
