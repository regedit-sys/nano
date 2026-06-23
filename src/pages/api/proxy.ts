import type { APIRoute } from "astro"

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

function isHlsMediaSegment(url: string): boolean {
  const u = url.toLowerCase()
  return (
    u.includes(".ts") ||
    u.includes(".m4s") ||
    u.includes(".aac") ||
    u.includes(".vtt") ||
    u.includes(".webvtt") ||
    u.includes("/seg") ||
    u.includes("segment") ||
    u.includes("/chunk") ||
    u.includes("/fragment") ||
    u.includes("/part") ||
    u.includes("/slice") ||
    u.includes("stream_") ||
    (u.includes("/hls/") && (u.includes(".mp4") || u.includes(".bin") || !u.includes(".m3u8")))
  )
}

function normalizeHeaderKey(key: string): string {
  const k = key.toLowerCase()
  if (k === "user-agent") return "User-Agent"
  if (k === "referer") return "Referer"
  if (k === "origin") return "Origin"
  if (k === "accept") return "Accept"
  if (k === "accept-language") return "Accept-Language"
  if (k === "range") return "Range"
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-")
}

async function fetchWithIpOverride(
  targetUrl: string,
  options: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
): Promise<Response> {
  // Check if we are running in Node.js
  const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
  if (!isNode) {
    return fetch(targetUrl, {
      method: options.method || "GET",
      headers: options.headers,
      signal: options.signal,
    });
  }

  try {
    const moduleName = "node:https";
    const https = await import(moduleName);
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(targetUrl)
        const ipList = ["129.121.103.59", "104.21.67.210", "172.67.181.33"]
        const ip = ipList[Math.floor(Math.random() * ipList.length)]
        
        const requestHeaders = { ...options.headers }
        requestHeaders["Host"] = urlObj.hostname
        
        const reqOptions = {
          hostname: ip,
          port: 443,
          path: urlObj.pathname + urlObj.search,
          method: options.method || "GET",
          servername: urlObj.hostname,
          headers: requestHeaders,
          rejectUnauthorized: false,
        }
        
        const req = https.request(reqOptions, (res: any) => {
          const chunks: any[] = []
          res.on("data", (chunk: any) => chunks.push(chunk))
          res.on("end", () => {
            const buffer = Buffer.concat(chunks)
            const headers = new Headers()
            for (const [k, v] of Object.entries(res.headers)) {
              if (Array.isArray(v)) {
                v.forEach((val) => headers.append(k, val))
              } else if (v !== undefined) {
                headers.set(k, v as string)
              }
            }
            resolve(
              new Response(buffer, {
                status: res.statusCode,
                statusText: res.statusMessage,
                headers,
              }),
            )
          })
        })
        req.on("error", (err: any) => {
          reject(err)
        })
        if (options.signal) {
          options.signal.addEventListener("abort", () => {
            req.destroy()
            reject(new Error("aborted"))
          })
        }
        req.end()
      } catch (e) {
        reject(e)
      }
    })
  } catch (e) {
    return fetch(targetUrl, {
      method: options.method || "GET",
      headers: options.headers,
      signal: options.signal,
    });
  }
}

function rewriteM3U8(
  content: string,
  originalUrl: string,
  originalHeaders: Record<string, string>,
): string {
  const lastSlash = originalUrl.lastIndexOf("/")
  const basePath = lastSlash >= 0 ? originalUrl.substring(0, lastSlash + 1) : originalUrl

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (trimmed.startsWith("#") && trimmed.includes("URI=")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUri = uri.startsWith("http") ? uri : new URL(uri, basePath).href
          const payload = JSON.stringify({ url: absoluteUri, headers: originalHeaders })
          const base64 = Buffer.from(payload).toString("base64")
          return `URI="/api/proxy?data=${encodeURIComponent(base64)}&isSegment=true"`
        })
      }

      if (trimmed.startsWith("#")) return line

      const absoluteUrl = trimmed.startsWith("http") ? trimmed : new URL(trimmed, basePath).href
      const isPlaylist = absoluteUrl.toLowerCase().includes(".m3u8")
      const payload = JSON.stringify({ url: absoluteUrl, headers: originalHeaders })
      const base64 = Buffer.from(payload).toString("base64")
      const baseProxy = `/api/proxy?data=${encodeURIComponent(base64)}`
      return isPlaylist ? baseProxy : `${baseProxy}&isSegment=true`
    })
    .join("\n")
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const dataParam = url.searchParams.get("data")
    let targetUrl: string | null = null
    let customHeaders: Record<string, string> = {}

    if (dataParam) {
      try {
        const decoded = JSON.parse(Buffer.from(dataParam, "base64").toString("utf8"))
        targetUrl = decoded.url
        customHeaders = decoded.headers || {}
      } catch {}
    } else {
      targetUrl = url.searchParams.get("url")
      const referer = url.searchParams.get("referer") || request.headers.get("referer") || ""
      const origin = url.searchParams.get("origin") || request.headers.get("origin") || ""
      const userAgent = url.searchParams.get("userAgent") || request.headers.get("user-agent") || ""
      customHeaders = {
        Referer: referer,
        Origin: origin,
        "User-Agent": userAgent,
      }
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      })
    }

    let targetUrlObj: URL
    try {
      targetUrlObj = new URL(targetUrl)
    } catch {
      targetUrlObj = new URL(targetUrl, request.url)
      targetUrl = targetUrlObj.href
    }

    const isSegment = url.searchParams.get("isSegment") === "true" || isHlsMediaSegment(targetUrl)

    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    }

    for (const [k, v] of Object.entries(customHeaders)) {
      const normKey = normalizeHeaderKey(k)
      headers[normKey] = v
    }

    const targetOrigin = targetUrlObj.origin
    if (!headers["Referer"]) {
      headers["Referer"] = `${targetOrigin}/`
    }
    if (!headers["Origin"]) {
      headers["Origin"] = targetOrigin
    }

    if (targetUrlObj.hostname.includes("eat-peach.sbs") || targetUrlObj.hostname.includes("peachify.top")) {
      headers["Referer"] = "https://peachify.top/"
      headers["Origin"] = "https://peachify.top"
    }

    const rangeHeader = request.headers.get("range")
    if (rangeHeader) {
      headers["Range"] = rangeHeader
    }

    let response: Response
    const isDulo = targetUrlObj.hostname === "dulo.tv" || targetUrlObj.hostname === "www.dulo.tv"

    if (isDulo) {
      response = await fetchWithIpOverride(targetUrl, {
        method: "GET",
        headers,
      })
    } else {
      response = await fetch(targetUrl, {
        method: "GET",
        headers,
      })
    }

    const responseHeaders = new Headers()
    responseHeaders.set("Access-Control-Allow-Origin", "*")
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
    responseHeaders.set("Access-Control-Allow-Headers", "*")
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, X-Proxy-Set-Cookie")

    const skipHeaders = new Set(["content-security-policy", "x-frame-options", "content-encoding", "transfer-encoding"])

    response.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    const contentType = (response.headers.get("content-type") || "").toLowerCase()
    const urlHintM3U8 =
      targetUrl.includes(".m3u8") ||
      targetUrl.includes("/hls/") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl")

    const urlPatternHint =
      /(?:master|index|playlist)\b/.test(targetUrl) &&
      !targetUrl.endsWith(".mp4") &&
      !targetUrl.endsWith(".ts")

    const needsSniff =
      !urlHintM3U8 &&
      (urlPatternHint || contentType.includes("text/plain") || contentType.includes("octet-stream"))

    if (urlHintM3U8 || needsSniff) {
      const text = await response.text()
      const trimmed = text.trimStart()
      const isM3U8ByBody = trimmed.startsWith("#EXTM3U") || trimmed.startsWith("#EXT-X-")
      const isActuallyM3U8 = isM3U8ByBody || contentType.includes("mpegurl")

      if (isActuallyM3U8) {
        const rewritten = rewriteM3U8(text, targetUrl, customHeaders)
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl")
        responseHeaders.set("Cache-Control", "public, max-age=3")
        responseHeaders.delete("content-length")
        return new Response(rewritten, {
          status: response.status,
          headers: responseHeaders,
        })
      }

      responseHeaders.delete("content-length")
      return new Response(text, {
        status: response.status,
        headers: responseHeaders,
      })
    }

    if (isSegment) {
      if (response.ok) {
        responseHeaders.set("Cache-Control", "public, max-age=600, immutable")
      }
      const lowerUrl = targetUrl.toLowerCase()
      if (lowerUrl.includes(".vtt") || lowerUrl.includes(".webvtt")) {
        responseHeaders.set("Content-Type", "text/vtt")
      } else if (lowerUrl.includes(".m4s")) {
        responseHeaders.set("Content-Type", "video/iso.segment")
      } else if (lowerUrl.includes(".mp4")) {
        responseHeaders.set("Content-Type", "video/mp4")
      } else if (lowerUrl.includes(".aac")) {
        responseHeaders.set("Content-Type", "audio/aac")
      } else {
        responseHeaders.set("Content-Type", "video/mp2t")
      }
    }

    if (response.body) {
      try {
        responseHeaders.delete("content-length")
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        })
      } catch {}
    }

    const body = await response.arrayBuffer()
    responseHeaders.delete("content-length")
    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    })
  }
}

export const HEAD = GET
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  })
}
