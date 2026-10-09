/*
 * POS service worker — offline app shell.
 *
 * Goal: the app keeps loading when the shop's internet/power blips. We cache
 * the Next.js app shell + static assets so a reload works offline; the sale
 * data itself is handled in the app (IndexedDB catalogue cache + offline read
 * cache + offline sale queue). We NEVER cache API writes.
 *
 * Strategies:
 *   - navigations  → network-first, fall back to THIS route's cached page
 *   - RSC payloads (?_rsc=) → passed through; never cached (see below)
 *   - static (_next/static, icons, fonts, images) → stale-while-revalidate
 *   - cross-origin (Django API, analytics) → left untouched
 *   - non-GET (POST/PUT sales, cart-state) → never intercepted
 *
 * Why precache EVERY app route, not just "/pos": with the App Router, moving
 * between pages in the running app is an RSC fetch, not a navigation — so
 * browsing the app online never fills the navigation cache. Only a hard load
 * (typed URL, F5, or the installed PWA's start_url) does. That is exactly how
 * "/pos works offline but /inventory shows the offline page" happens: /pos was
 * precached at install, /inventory was never a navigation the worker saw.
 * Precaching the whole route list at install removes that dependency on where
 * the user happened to press reload.
 */

// Version every cache by the build id passed in the registration URL
// (/sw.js?v=<build>). A new deploy ⇒ new id ⇒ new cache names ⇒ the activate
// handler below deletes the previous version's caches. Fresh start every time.
const VERSION = (() => {
  try {
    return new URL(self.location.href).searchParams.get("v") || "v0"
  } catch {
    return "v0"
  }
})()

const NAV_CACHE = `pos-nav-${VERSION}`
const STATIC_CACHE = `pos-static-${VERSION}`
// Drink and customer pictures (served from the storage host, signed links).
// NOT versioned: a picture does not change with a deploy, and keeping them is
// what keeps the menu's photos on screen while the server restarts.
const IMG_CACHE = "pos-img"
const IMG_MAX = 400
const KEEP = new Set([NAV_CACHE, STATIC_CACHE, IMG_CACHE])

// Every page a user can land on: the nav rail's routes, plus /login and
// /price. lib/offline/sw-routes.test.ts fails if a page is added under
// app/(app)/ and not listed here.
const PRECACHE_ROUTES = [
  // The customer app. Profile and menu have to work on a dead connection —
  // only placing an order needs the network, and the app says so itself.
  "/app",
  "/login",
  "/pos",
  "/menu",
  "/menu/stats",
  "/sales",
  // The café pages. /live in particular is the one a barista holds on a phone
  // behind the counter — the screen least able to afford a dead connection.
  "/live",
  "/orders",
  "/inventory",
  "/inventory/stats",
  "/purchases",
  // Raw materials and expenses. Reads work offline from the cache; their
  // writes are online-only until week two.
  "/stock",
  "/expenses",
  "/staff",
  "/reports",
  "/settings",
  "/customers",
  "/guide",
  "/debts",
  "/debts/stats",
  "/price",
]

/**
 * A cached HTML shell is useless without the chunks it loads: offline the
 * document renders and then dies on a failed <script src="/_next/static/…">.
 * Next names those per build, so we can't hardcode them — we read them back
 * out of the HTML we just precached and warm them into the static cache.
 */
async function warmAssetsFrom(html, cache) {
  const urls = new Set()
  const re = /\/_next\/static\/[^"'\s>)\\]+/g
  let m
  while ((m = re.exec(html)) !== null) {
    // Strip HTML entities that can trail a URL inside an attribute, and skip
    // fragments the regex catches inside inline RSC data ("/_next/static/c").
    const u = m[0].replace(/&amp;/g, "&")
    if (/\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|ico)$/.test(u)) urls.add(u)
  }
  await Promise.allSettled([...urls].map((u) => warmOnce(u, cache)))
}

/* Every route lists mostly the SAME chunks. Fetching each one once, a few at
 * a time, matters: 21 routes asking for one URL at once queue behind the
 * browser's cache lock and its six connections, and the install sat there
 * until the worker gave up — which is how the till ended up with no offline
 * copy at all. */
const warming = new Map()
let slots = 4
const queue = []
function withSlot(fn) {
  return new Promise((resolve) => {
    const run = async () => {
      slots--
      try {
        resolve(await fn())
      } catch {
        resolve(undefined)
      } finally {
        slots++
        const next = queue.shift()
        if (next) next()
      }
    }
    if (slots > 0) run()
    else queue.push(run)
  })
}

function warmOnce(u, cache) {
  if (!warming.has(u)) {
    warming.set(
      u,
      withSlot(async () => {
        if (await cache.match(u)) return
        const res = await fetchWithin(u, 20_000)
        // Put the response itself (no clone left unread), and always finish
        // reading a failed one — an unread body holds its connection.
        if (res.ok) await cache.put(u, res)
        else await res.body?.cancel()
      }),
    )
  }
  return warming.get(u)
}

/** fetch() that gives up: one hung request must never hold the install. */
async function fetchWithin(url, ms) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { credentials: "same-origin", signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

// Without /pos cached there is no working POS offline, so it is the one route
// whose failure must abort the install.
const ESSENTIAL_ROUTE = "/pos"

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const nav = await caches.open(NAV_CACHE)
      const stat = await caches.open(STATIC_CACHE)
      await Promise.allSettled(
        PRECACHE_ROUTES.map(async (route) => {
          try {
            const res = await fetchWithin(route, 20_000)
            if (!res.ok) {
              await res.body?.cancel()
              return
            }
            await nav.put(route, res.clone())
            await warmAssetsFrom(await res.text(), stat)
          } catch {
            return
          }
        }),
      )
      // Every fetch above is allowSettled + try/catch, so the install would
      // otherwise "succeed" having downloaded nothing — and activate would
      // then delete the previous version's caches. Deploy day on a weak shop
      // connection would leave the till with NO offline shell at all, which
      // only shows up hours later when the internet actually drops.
      // Throwing here keeps the old worker (and its caches) in charge.
      if (!(await nav.match(ESSENTIAL_ROUTE))) {
        throw new Error("precache failed: /pos unavailable, keeping old worker")
      }
      // NO skipWaiting() here on purpose. Taking over immediately reloaded the
      // page the moment a deploy landed — potentially mid-sale, with a
      // customer at the counter. The new worker now waits until the cashier
      // taps "يوجد تحديث جديد" (components/offline/update-prompt.tsx), which
      // posts SKIP_WAITING below.
      //
      // First install is different: there is no controller to displace and
      // nothing on screen to interrupt, so take over at once.
      if (!self.registration.active) await self.skipWaiting()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Belt and braces: only bin the old caches once this version's shell is
      // demonstrably present.
      const nav = await caches.open(NAV_CACHE)
      if (await nav.match(ESSENTIAL_ROUTE)) {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)),
        )
      }
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname.startsWith("/brand") ||
    /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|ico|gif)$/.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  // Pictures from the storage host: keep a copy, keyed WITHOUT the signature
  // (it changes on every response), and show it whenever the host or our
  // server cannot be reached.
  if (url.origin !== self.location.origin && req.destination === "image") {
    event.respondWith(cachedPicture(req, url))
    return
  }
  // Otherwise only manage our own origin — never the API, Convex realtime, or analytics.
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          // A deploy in progress: the proxy answers 502/503/504 for a server
          // that is restarting. That is not a page — show the copy we have,
          // exactly as if the network were down, so nobody sees "Bad Gateway".
          if (fresh.status >= 500) {
            const cache = await caches.open(NAV_CACHE)
            const saved = (await cache.match(req)) || (await cache.match(url.pathname))
            if (saved) return saved
            return fresh
          }
          // Only cache a real page. A 502/504 from Traefik mid-deploy, or a
          // Next 500, would otherwise become THIS route's offline copy — and
          // the till would serve an error page as the POS the next time the
          // internet dropped. `type === "basic"` also skips opaque redirects,
          // which cache.put rejects.
          if (fresh.ok && fresh.type === "basic") {
            const cache = await caches.open(NAV_CACHE)
            cache.put(req, fresh.clone()).catch(() => {})
          }
          return fresh
        } catch {
          // Offline: serve THIS route's cached HTML if we have it. Never fall
          // back to "/" — that flashed the marketing home before the real page.
          const cache = await caches.open(NAV_CACHE)
          return (
            (await cache.match(req)) ||
            (await cache.match(url.pathname)) ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>غير متصل</title><body style='font-family:sans-serif;direction:rtl;text-align:center;padding:3rem'>لا يوجد اتصال — أعد المحاولة عند عودة الشبكة.",
              { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
            )
          )
        }
      })(),
    )
    return
  }

  // App Router client-side navigation is an RSC fetch (`?_rsc=…`), not a
  // navigation. We deliberately do NOT serve those from cache: an RSC payload
  // is keyed to a router state tree, and replaying a stale one renders a
  // broken tree instead of failing cleanly. Left alone it fails offline, Next
  // falls back to a full navigation, and the branch above answers that from
  // the nav cache — which is why precaching every route above matters.
  if (url.searchParams.has("_rsc")) return

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => null)
        return cached || (await network) || Response.error()
      })(),
    )
  }
})

/** Origins whose pictures cannot be read with CORS — we pass those through
 *  and keep the (opaque) answer only when we have none yet. */
const noCors = new Set()

async function cachedPicture(req, url) {
  const key = url.origin + url.pathname
  const cache = await caches.open(IMG_CACHE)
  const keep = (res) => {
    cache.put(key, res.clone()).then(trimPictures).catch(() => {})
    return res
  }
  if (!noCors.has(url.origin)) {
    try {
      const res = await fetch(req.url, { mode: "cors", credentials: "omit" })
      if (res.ok) return keep(res)
      // Expired link, or gone: the saved copy is better than a broken image.
      return (await cache.match(key)) || res
    } catch {
      // Either the host is down, or it does not allow CORS. Remember the
      // second so we stop asking twice.
      const saved = await cache.match(key)
      if (saved) return saved
      noCors.add(url.origin)
    }
  }
  try {
    const res = await fetch(req)
    if (!(await cache.match(key))) keep(res)
    return res
  } catch {
    return (await cache.match(key)) || Response.error()
  }
}

let trimming = false
async function trimPictures() {
  if (trimming) return
  trimming = true
  try {
    const cache = await caches.open(IMG_CACHE)
    const keys = await cache.keys()
    // Oldest first (insertion order); keep the most recent IMG_MAX.
    for (const k of keys.slice(0, Math.max(0, keys.length - IMG_MAX))) await cache.delete(k)
  } finally {
    trimming = false
  }
}
