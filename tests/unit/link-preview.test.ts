import { expect, it } from "vitest";
import {
  fetchPublic,
  parsePreview,
  previewUrl,
  publicAddress,
} from "../../apps/server/link-preview";

it.each([
  "127.0.0.1",
  "10.1.2.3",
  "192.168.0.1",
  "172.16.0.1",
  "169.254.169.254",
  "0.0.0.0",
  "100.64.0.1",
  "224.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fe80::1",
  "2001:db8::1",
])("rejects non-public address %s", (address) => {
  expect(publicAddress(address)).toBe(false);
});
it("allows public IPv4 and IPv6 addresses", () => {
  expect(publicAddress("93.184.216.34")).toBe(true);
  expect(publicAddress("2606:4700:4700::1111")).toBe(true);
});
it.each([
  "file:///etc/passwd",
  "http://user:password@example.com",
  "http://example.com:8080",
  "javascript:alert(1)",
])("rejects unsupported preview URL %s", (url) => {
  expect(() => previewUrl(url)).toThrow();
});
it("blocks private requests before connecting", async () => {
  await expect(
    fetchPublic("http://127.0.0.1:80/", "html", AbortSignal.timeout(1000)),
  ).rejects.toThrow("Private network");
});
it("parses OpenGraph attributes and entities without evaluating markup", () => {
  const result = parsePreview(
    `<title>Fallback</title><meta content="A &amp; B" property="og:title"><meta property="og:image" content="/cover.png"><meta property="og:description" content="Readable"><script>throw Error('must not run')</script>`,
    "https://example.com/post",
  );
  expect(result).toEqual({
    title: "A & B",
    image: "https://example.com/cover.png",
    description: "Readable",
  });
});
it("falls back to document title and ignores unsafe image metadata", () => {
  expect(
    parsePreview(
      '<title>Title</title><meta property="og:image" content="file:///x">',
      "https://example.com",
    ),
  ).toEqual({ title: "Title", image: undefined, description: "" });
});
