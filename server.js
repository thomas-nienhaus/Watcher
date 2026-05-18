'use strict'

const http = require('http')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = http.createServer((req, res) => {
    handle(req, res)
  })

  // In dev, tsx resolves .ts files directly.
  // In prod, tsc compiles src/server/ → dist/ (rootDir=src/server, outDir=dist)
  // so src/server/index.ts becomes dist/index.js
  const serverModule = dev
    ? require('./src/server/index')
    : require('./dist/index')

  serverModule.attachSocketServer(httpServer)

  httpServer.listen(port, () => {
    console.log(`> BabyWatch ready on http://localhost:${port}`)
    console.log(`> Mode: ${dev ? 'development' : 'production'}`)
  })
})
