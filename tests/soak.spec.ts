import { test, expect } from '@playwright/test'

const SOAK_MS = parseInt(process.env.SOAK_DURATION_MS ?? String(5 * 60 * 1000), 10)
const POLL_INTERVAL_MS = 30_000

test('soak: stream stays alive', async ({ browser }) => {
  test.setTimeout(SOAK_MS + 60_000)

  // ── Camera context ──────────────────────────────────────────────────────────
  const cameraCtx = await browser.newContext({
    permissions: ['camera', 'microphone'],
  })
  const cameraPage = await cameraCtx.newPage()
  await cameraPage.goto('/camera')

  // Click "Camera starten" and wait for the streaming state to appear
  await cameraPage.getByRole('button', { name: /camera starten/i }).click()

  // The bottom sheet with the room code appears once streaming starts.
  // RoomCodeDisplay renders two halves of the code with a space between them
  // inside a span.font-mono element.
  await cameraPage.waitForSelector('.font-mono', { timeout: 20_000 })
  const rawCode = await cameraPage.locator('.font-mono').first().textContent()
  const roomCode = (rawCode ?? '').replace(/\s/g, '')
  expect(roomCode).toMatch(/^[A-Z2-9]{6}$/)
  console.log(`[soak] Room code: ${roomCode}`)

  // ── Viewer context ──────────────────────────────────────────────────────────
  const viewerCtx = await browser.newContext({
    permissions: ['camera', 'microphone'],
  })
  const viewerPage = await viewerCtx.newPage()
  await viewerPage.goto('/viewer/join')

  // Fill room code one character at a time into the 6 individual input boxes.
  // The join page uses maxLength on each input.
  const inputs = viewerPage.locator('input[maxlength]')
  await expect(inputs).toHaveCount(6, { timeout: 5_000 })
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).fill(roomCode[i])
  }

  // Submit
  await viewerPage.getByRole('button', { name: /verbinden/i }).click()

  // Wait for navigation to the viewer room page
  await viewerPage.waitForURL(`**/viewer/${roomCode}`, { timeout: 10_000 })

  // Wait until video has pixels flowing (videoWidth > 0 means a frame was decoded)
  await viewerPage.waitForFunction(
    () => {
      const v = document.querySelector('video')
      return v !== null && v.videoWidth > 0
    },
    { timeout: 30_000 }
  )
  console.log('[soak] Stream confirmed — starting soak loop')

  // ── Soak polling loop ───────────────────────────────────────────────────────
  const startTime = Date.now()
  let pollCount = 0
  let interruptions = 0

  while (Date.now() - startTime < SOAK_MS) {
    await viewerPage.waitForTimeout(POLL_INTERVAL_MS)
    pollCount++

    const videoOk = await viewerPage.evaluate(() => {
      const v = document.querySelector('video')
      return v !== null && v.videoWidth > 0
    })

    const offlineVisible = await viewerPage
      .locator('text=Camera offline')
      .isVisible()
      .catch(() => false)

    if (!videoOk || offlineVisible) {
      interruptions++
      console.warn(`[soak] Poll ${pollCount}: INTERRUPTION — video:${videoOk} offline:${offlineVisible}`)
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.log(`[soak] Poll ${pollCount} @ ${elapsed}s — OK:${videoOk} offline:${offlineVisible}`)
  }

  // Final report
  const totalSec = Math.floor((Date.now() - startTime) / 1000)
  console.log(`[soak] Done: ${totalSec}s, ${pollCount} polls, ${interruptions} interruptions`)
  expect(interruptions, `Stream interrupted ${interruptions} times`).toBe(0)

  await cameraCtx.close()
  await viewerCtx.close()
})
