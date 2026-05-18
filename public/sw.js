const CACHE_NAME = 'babywatch-v1'

// App shell resources to pre-cache
const SHELL_URLS = ['/', '/camera', '/viewer/join']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept Socket.IO, API routes, or HMR websockets
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('_next/webpack-hmr')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // Cache successful GET responses for static assets and pages
          if (event.request.method === 'GET' && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline: return cached home page as fallback shell
          return caches.match('/') ?? new Response('BabyWatch is offline', { status: 503 })
        })

      // Cache-first for static assets, network-first for HTML pages
      const isStaticAsset =
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/')

      return isStaticAsset && cached ? cached : networkFetch
    })
  )
})
