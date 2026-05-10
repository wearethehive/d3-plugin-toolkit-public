---
type: pattern
status: confirmed
tested: "2026-04-24"
scope: plugin-frontend
---

# Long-Lived `fetch()` Polling in a Designer CEF Panel

Covers two related robustness rules for plugins that perform background HTTP
polling inside Designer's plugin webview. The motivating case was OAuth
device-flow polling, but the rules apply to any long-lived fetch loop.


## Rule 1 — CEF Throttles Background `fetch()` When The Window Loses Focus

### Symptom

Google OAuth device flow:

1. Plugin calls `/device/code`, gets `device_code` + `user_code` + `interval`.
2. User is shown the `user_code` and a link to `google.com/device`.
3. Plugin begins a `setInterval` poll against `/token`, every `interval`
   seconds, waiting for the user to authorise.
4. User tabs to their web browser, enters the code, Google shows
   **"Success! Device connected"**.
5. User tabs back to Designer — **plugin is still sat on "waiting for
   authorisation"**. The poll never picked up the tokens, even though the
   server had them ready.

### Root Cause

Designer's plugin webview is a CEF instance. When the CEF window loses
focus (user tabs away) CEF appears to throttle or suspend background
`fetch()` calls issued from `setInterval`. The poll that *should* have
fired during the browser authorisation never did, or fired far later than
the interval suggested. Google's OAuth device flow assumes your client
polls on a predictable schedule — a poll that is 60+ seconds late may
miss the token window or look like a dead client.

This is consistent with observed CEF / Chromium background-throttling
behaviour in webviews with no visibility API hookup.

### Mitigation (Required For Any Long-Lived Poll)

Three-part fix, all three are required:

1. **Persist the poll state to `localStorage`** as soon as you receive it.
   Do not hold `device_code` only in component state — a re-mount or
   window reopen will lose it and the flow cannot resume.

2. **Resume polling on component mount** by reading the persisted state,
   checking whether enough time has elapsed since the last successful poll,
   and firing an immediate poll before re-scheduling the interval.

3. **Expose a manual "Check now" button** in the UI. When the user
   returns from authorising in their browser, they can press it to force
   an immediate poll, side-stepping any stale `setInterval` that the
   throttling may have delayed.

### Pattern Sketch

```ts
const POLL_KEY = 'my-plugin:oauth-poll'

interface PollState {
  deviceCode: string
  interval: number
  startedAt: number
}

function savePollState(s: PollState) {
  localStorage.setItem(POLL_KEY, JSON.stringify(s))
}

function loadPollState(): PollState | null {
  const raw = localStorage.getItem(POLL_KEY)
  return raw ? JSON.parse(raw) : null
}

function clearPollState() {
  localStorage.removeItem(POLL_KEY)
}

async function startDeviceFlow() {
  const { deviceCode, userCode, interval } = await requestDeviceCode()
  savePollState({ deviceCode, interval, startedAt: Date.now() })
  scheduleImmediatePoll()   // do not wait for the first interval tick
}

// Resume on mount — handles the "user tabbed away and came back" case
onMounted(() => {
  const s = loadPollState()
  if (s) scheduleImmediatePoll()   // fire immediately regardless of interval
})

// Always expose a manual trigger — the user knows they just authorised
function checkNow() {
  if (loadPollState()) scheduleImmediatePoll()
}
```

### Generalisation

Any plugin doing **any** long-lived background fetch — not just OAuth —
is at risk of CEF throttling. Applies to:

- Polling a remote status endpoint (companion apps, build servers).
- Watching for external file / resource changes over HTTP.
- Any `setInterval` loop whose correctness depends on fires landing at
  their scheduled times.

When the plugin webview loses focus, assume the timer may stretch
arbitrarily. Design for: persist state, re-fire on focus/mount, expose a
manual trigger.

---

## Rule 2 — OAuth Token Parsing Must Accept `access_token` Alone

### Symptom

`pollForToken()` used to require **both** `access_token` AND `refresh_token`
in the `/token` response to treat the poll as successful. On re-authorisation
(user previously consented, comes back without `prompt=consent`), Google
may return only `access_token` — the refresh token is already on file with
Google and is not re-emitted.

Previous behaviour: the poll received the `access_token`, the "refresh_token
missing" branch treated the response as incomplete, the poll dropped the
access token and continued waiting. User sees "still polling" forever
despite having authorised successfully.

### Fix

Accept `access_token` alone, and preserve any `refresh_token` that was
saved on a previous authorisation:

```ts
// In the success branch of pollForToken()
const prev = loadSavedTokens()
const merged = {
  accessToken: resp.access_token,                        // from this poll
  refreshToken: resp.refresh_token ?? prev?.refreshToken, // keep old if absent
  expiresAt: Date.now() + resp.expires_in * 1000,
}
saveTokens(merged)
```

If this is the user's first authorisation and Google somehow returns no
refresh token at all, surface that as a recoverable warning — the user
can re-run the flow with `prompt=consent` to force one — rather than
silently stalling.

---

## What Does NOT Work

- ❌ Relying on `setInterval` alone with no persistence — state is lost on
  reopen, and the interval may be throttled to uselessness in the
  background.
- ❌ Page Visibility API shims alone — they detect the transition but do
  not retroactively fire missed polls.
- ❌ Bumping the interval shorter to "work around" throttling — the
  throttle scales with background time, not interval length.

## Related

- `patterns/plugin-console-debugging.md` — CEF DevTools is NOT available,
  so debugging a stuck poll means reading Designer's log for
  `[WebViewHandler] Console :` lines. Plan in-UI debug surfaces up front.
- `patterns/subprocess-from-sandbox.md` — adjacent: when a poll is too
  flaky for CEF, some flows are better served by a companion subprocess
  that the plugin talks to over a local socket.
