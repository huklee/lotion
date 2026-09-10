import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
import { AppError } from "../../packages/document-schema/index";

export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
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
    const answers = await Promise.race([
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
    if (
      !answers.length ||
      answers.some(({ address }) => !publicAddress(address))
    )
      throw new AppError(400, "Private network previews are not allowed");
    const answer = answers[0];
    const result = await new Promise<{ bytes: Buffer; location?: string }>(
      (resolve, reject) => {
        const request = (url.protocol === "https:" ? https : http).get(
          url,
          {
            signal,
            agent: false,
            headers: {
              "User-Agent": "Yestion-LinkPreview/1.0",
              Accept:
                kind === "html"
                  ? "text/html"
                  : "image/png,image/jpeg,image/webp,image/gif",
              "Accept-Encoding": "identity",
            },
            lookup: ((_hostname: string, options: any, callback: any) => {
              if (options.all) callback(null, [answer]);
              else callback(null, answer.address, answer.family);
            }) as any,
          },
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
