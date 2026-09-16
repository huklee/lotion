import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
import { AppError } from "../../packages/document-schema/index";

export function publicAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    const processed = ipaddr.process(address);
    if (parsed.kind() === "ipv4" || processed.kind() === "ipv4")
      return processed.range() === "unicast";

    const bytes = parsed.toByteArray();
    const rfc6052 = parsed.range() === "rfc6052";
    const localTranslationPrefix = [0x00, 0x64, 0xff, 0x9b, 0x00, 0x01].every(
      (byte, index) => bytes[index] === byte,
    );

    // Validate embedded IPv4 destinations for both RFC 6052's /96 prefix and
    // RFC 8215's local-use /48 prefix. This prevents NAT64 from turning an
    // allowed IPv6 literal into a private-network hop.
    if (rfc6052) return publicAddress(bytes.slice(12).join("."));
    if (localTranslationPrefix) {
      if (bytes[8] !== 0) return false;
      return publicAddress([bytes[6], bytes[7], bytes[9], bytes[10]].join("."));
    }
    return processed.range() === "unicast";
  } catch {
    return false;
  }
}

export function publicAddresses<T extends { address: string }>(answers: T[]) {
  return answers.filter(({ address }) => publicAddress(address));
}

export function previewUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "Invalid preview URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    raw.length > 4096
  )
    throw new AppError(400, "Preview requires a public HTTP or HTTPS URL");
  url.hash = "";
  return url;
}

// Validate each redirect and pin the connection to the validated DNS answer.
// Never follow a second DNS lookup at connection time (DNS rebinding).
export async function fetchPublic(
  raw: string,
  kind: "html" | "image",
  signal: AbortSignal,
) {
  let url = previewUrl(raw);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const resolved = await Promise.race([
      lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true }),
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new AppError(504, "Preview timed out"));
        else
          signal.addEventListener(
            "abort",
            () => reject(new AppError(504, "Preview timed out")),
            { once: true },
          );
      }),
    ]);
    const answers = publicAddresses(resolved);
    if (!answers.length)
      throw new AppError(400, "Private network previews are not allowed");
    const result = await new Promise<{ bytes: Buffer; location?: string }>(
      (resolve, reject) => {
        const requestOptions = {
          signal,
          agent: false,
          headers: {
            "User-Agent": "Lotion-LinkPreview/1.0",
            Accept:
              kind === "html"
                ? "text/html"
                : "image/png,image/jpeg,image/webp,image/gif",
            "Accept-Encoding": "identity",
          },
          lookup: ((_hostname: string, options: any, callback: any) => {
            if (options.all) callback(null, answers);
            else callback(null, answers[0].address, answers[0].family);
          }) as any,
          autoSelectFamily: answers.length > 1,
        } as http.RequestOptions & { autoSelectFamily: boolean };
        const request = (url.protocol === "https:" ? https : http).get(
          url,
          requestOptions,
          (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
              const location = response.headers.location;
              response.destroy();
              if (location) resolve({ bytes: Buffer.alloc(0), location });
              else reject(new AppError(502, "Invalid preview redirect"));
              return;
            }
            const type = (response.headers["content-type"] ?? "")
              .split(";")[0]
              .trim();
            const accepted =
              kind === "html"
                ? ["text/html", "application/xhtml+xml"]
                : ["image/png", "image/jpeg", "image/webp", "image/gif"];
            if (response.statusCode !== 200 || !accepted.includes(type)) {
              response.destroy();
              reject(new AppError(502, "Preview content unavailable"));
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > (kind === "html" ? 2 : 5) * 1024 * 1024) {
                response.destroy(
                  new AppError(413, "Preview exceeds size limit"),
                );
                return;
              }
              chunks.push(chunk);
            });
            response.on("error", reject);
            response.on("end", () => resolve({ bytes: Buffer.concat(chunks) }));
          },
        );
        request.on("error", reject);
      },
    );
    if (result.location) {
      url = previewUrl(new URL(result.location, url).href);
      continue;
    }
    return { url: url.href, bytes: result.bytes };
  }
  throw new AppError(502, "Too many preview redirects");
}

export function parsePreview(html: string, url: string) {
  const $ = load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"],meta[name="${name}"]`)
      .first()
      .attr("content")
      ?.trim();
  const title = (
    meta("og:title") ||
    meta("twitter:title") ||
    $("title").first().text() ||
    new URL(url).hostname
  )
    .trim()
    .slice(0, 500);
  let image: string | undefined;
  try {
    const value = meta("og:image") || meta("twitter:image");
    if (value) image = previewUrl(new URL(value, url).href).href;
  } catch {
    /* Optional image is invalid. */
  }
  return {
    title,
    image,
    description: (meta("og:description") || meta("description") || "").slice(
      0,
      1000,
    ),
  };
}
