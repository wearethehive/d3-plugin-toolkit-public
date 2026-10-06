---
type: pattern
status: confirmed
tested: "2026-07-07"
scope: plugin-backend
---

# Programming ETC Eos Cues via OSC-over-TCP to a Specific Console

## Rule

To record/label/delete Eos cues from a Disguise plugin's Python sandbox,
connect via **TCP (SLIP-framed OSC)** directly to the target console's own
IP, not UDP to whatever's configured as session Host. Send whole
command-line macros as single `/eos/newcmd` messages chained with the
literal word `Enter`, not `#`. Pause before closing the socket.

## Why this matters — the failure modes, in order discovered

1. **UDP `/eos/user/<n>/newcmd` only reaches the session Host.** In a
   multi-console Eos session, all *UDP* OSC traffic is documented by ETC as
   being handled exclusively by the Host device — sending UDP to a Client
   console's IP is silently accepted by nothing. Confirmed via ETC's own
   docs and by packet-capturing a known-working third-party tool
   (Flamingo Software's ToucanType) that successfully targets a specific
   *Client* console.

2. **TCP OSC bypasses the Host restriction.** ToucanType opens a **TCP**
   connection (SLIP-framed OSC, port `3037` in the tested configuration — Eos's
   configured OSC TCP port, not the ETC-documented default of 3032) directly
   to the target console's own IP. This is handled locally by whichever
   device you connect to, Host or not. Confirmed by packet capture: cues
   recorded via this method land correctly on a Client console with OSC
   RX/TCP enabled in that console's own Show Control settings.

3. **The connection gets its own virtual OSC user automatically.** Neither
   ToucanType nor our code ever sends `/eos/user/<n>` explicitly. Eos
   auto-assigns a fresh virtual user ID per TCP connection and announces it
   via `/eos/out/user <int>` as the first message on the connection — this
   is what keeps command-line-typed cues from clobbering whatever a real
   operator has typed as User 1. If you want a *stable* (non-random) user
   id across reconnects — e.g. to avoid colliding with a real operator's
   number if you reconnect and land on a number they're using — send
   `/eos/user <int>` yourself right after connecting, with a number you've
   confirmed no physical console is using.

4. **`#` as the OSC newcmd Enter-equivalent doesn't reliably commit across
   separate back-to-back messages.** Sending each action as its own
   `/eos/newcmd` (`"...#"` per message) resulted in Eos accepting the
   connection, receiving every packet, and recording **nothing** — no error,
   no response, just silence. ToucanType instead sends **one combined
   `/eos/newcmd` message per cue**, chaining every action with the literal
   word `Enter` inside a single string, e.g.:
   `"Chan 6001 _Cue 00 Cue_2 04 Cue_3 60 Enter Record Cue 601 / 4 Enter"`.
   Switching to this pattern fixed cue recording immediately.

5. **`Record Cue` on an *existing* cue may need two `Enter`s.** A fresh cue
   records with one Enter after `Record Cue <list> / <num>`. Re-recording a
   cue that already exists can pop an overwrite/merge confirmation that
   silently eats the rest of the batch unless dismissed —
   `... Enter Record Cue 601 / 22 Enter Enter Cue 601 / 22 Label ... Enter`.
   The same reasoning applies to `Delete Cue`, which always needs two.

6. **Closing the socket immediately after the last `sendall()` can drop the
   last message(s) in the batch**, even though earlier messages in the same
   connection succeed. Confirmed by packet capture: the last cue sent in a
   4-cue batch consistently failed to record while cues 1–3 succeeded,
   across three separate retries with identical command content. Fix: pause
   (`time.sleep`) before `sock.close()`, scaled with how much was just sent.
   A later attempt to make this pause *deterministic* by probing with
   `/eos/get/version` and blocking on `select()` for a reply backfired badly
   — that address isn't a verified Eos OSC address, and Eos reacts to it by
   tearing the connection down rather than replying, making the wait return
   almost instantly and defeating the purpose. **Don't invent probe
   addresses; a plain sleep is unglamorous but known to work.**

7. **Mode switches (Blind→Live) need more settle time than property writes,
   and a lingering command-line selection can block them entirely.** After
   programming, sending `/eos/key/BLIND` before and `/eos/key/LIVE` after a
   batch (mirroring ToucanType) keeps the recording work off live output.
   But `/eos/key/LIVE` alone was logged as received by Eos while the screen
   visibly stayed in Blind — fixed by sending `/eos/key/Clear_Cmd` (dismiss
   any pending channel/cue selection left over from the last `Chan ...`
   command) immediately before `/eos/key/LIVE`, plus a longer settle delay
   (~1.5–2.5s) than a simple `/eos/set/...` write needs. The *entry* side
   needs the same treatment: sending the first programming command
   immediately after `/eos/key/BLIND` with no pause risks it arriving before
   the mode switch has actually completed — pause briefly (~0.4s) after
   `BLIND` before sending anything else.

8. **Eos normalises quote characters in labels/scenes — normalise both sides
   before comparing.** Sending a label with `'single quotes'` comes back
   from Eos's own `/eos/get/cue/.../list` response with `"double quotes"`
   regardless of what was typed. A verification/check routine comparing an
   expected label (converted to `'`) against Eos's raw readback (`"`) will
   report every quoted label as mismatched even though it's correct. Fix:
   normalise both the expected and actual strings to the same quote
   character right before comparing, not just one side.

9. **Referencing `Cue <list> / <num>` while assigning Time/Delay creates a
   nonexistent cue in Blind — but it pops a confirmation dialog that needs
   a SECOND Enter, exactly like ToucanType's macro shows.** First pass at
   this dropped `Record Cue` entirely but only sent one Enter after
   `Time 0 Delay 0.0`; that produced a hard-looking failure — Eos's
   diagnostic log showed `Syntax: Cue 601 / 48 >>Error : Cue Does Not
   Exist` — which read as "direct reference can't create cues, `Record`
   is required." That was wrong. Confirmed directly on the physical
   console: typing `Cue 601/48 Enter` on a cue that doesn't exist yet pops
   a create-confirmation box, which the *second* Enter in ToucanType's
   `"... time 0 delay 0.0 enter enter ..."` dismisses. No `Record Cue`
   needed at all — the correct pattern matches ToucanType's macro exactly:
   `"Cue 601 / 4 Time 0 Delay 0 Enter Enter Chan 6001 Block Enter Chan 6001 _Cue 00 Cue_2 04 Cue_3 60 Enter Cue 601 / 4 Label ... Enter"`.
   Still not right on the first retry — with the double Enter added, the exact
   same still-bare cue number (`Cue 601 / 48`, no decimal) produced *total
   silence* in Eos's Context log (no execution trace at all, not even an
   error), while ToucanType's own successful capture for the identical cue
   number always used explicit decimal notation: `Cue 601 / 48.0`. Changed
   `cue_num()` to always emit `.0` instead of a bare integer — **confirmed
   working** on a live console with this exact fix.

10. **`Block` on the tracking channel prevents its value from being
    inherited/tracked forward from the previous cue.** Since the tracking
    channel (e.g. 6001) only carries an encoded disguise-cue-reference value
    rather than driving a real light, every cue needs to hold its own
    distinct value rather than silently tracking through from whichever
    cue came before it. Confirmed present in ToucanType's own captured
    macro (`... 6001 block enter ...` before assigning the parameter).

11. **A `(d<value>)` tag in the disguise cue name sets the Eos cue's
    Delay** — the same convention ToucanType reads from disguise cue names,
    e.g. `"Blackout (d5)"` → Eos `Delay` set to `5`. Left in the cue's
    Label as-is (not stripped). Parsed with plain string operations, not
    `re` — `re` isn't in this project's confirmed-importable sandbox stdlib
    list (see `sandbox-stdlib.md`), and this parse is simple enough not to
    risk an unverified import.

12. **Set `label` as a direct property (`/eos/set/cue/<list>/<num>/label`),
    not typed through the command line.** Confirmed as a real, documented
    Eos OSC address — same family as `scene`, which we already used this
    way successfully. This means a pure rename (only the label text
    changes) doesn't need to re-touch Time/Delay/Block/`_Cue` at all —
    those only need sending once, when a cue is first created. An earlier,
    disproven theory (see item 4's original notes) worried that typing
    "Label" through the command line could get corrupted by a label
    containing an Eos keyword like "enter" — that specific fear turned out
    to be unfounded (a label containing "enter" recorded correctly, see
    item 8's quote-normalisation finding), but setting it as a direct
    property is still simpler and strictly safer regardless.

13. **Designer sandbox execution time is a hard constraint on how long
    `program_eos()` can block, and it isn't just about that one call.**
    Padding the post-`BLIND` and post-`LIVE` waits generously (0.4s and
    1.5–2.5s) fixed those specific race conditions, but pushed this single
    blocking Designer sandbox call close enough to the ~4s execution-monitor
    limit (see `sandbox-stdlib.md`) that the *next* `execute()` call (the
    automatic Check that runs right after Program) started failing with an
    HTTP 500 — consistently, every time, regardless of how long the
    frontend then waited before calling Check. A longer client-side delay
    between Program and Check did nothing, because the problem wasn't Eos
    needing to settle, it was Designer's own execution engine left in a bad
    state by a single script that ran too close to its own limit. Fix:
    shrink the Python-side sleeps (post-`BLIND` 0.4s→0.2s, post-`LIVE`
    1.5–2.5s→0.6–1.2s) and lean on the JS-side delay instead, since a
    frontend `setTimeout` costs nothing against Designer's execution
    budget. Both the Live-switch and the Check-after-Program 500 were
    confirmed fixed together with these shorter waits.

## What works (confirmed)

```python
import socket, select

SLIP_END = b'\xc0'
SLIP_ESC = b'\xdb'

def slip_wrap(data):
    data = data.replace(SLIP_ESC, SLIP_ESC + b'\xdd')
    data = data.replace(SLIP_END, SLIP_ESC + b'\xdc')
    return SLIP_END + data + SLIP_END

def osc_str_msg(addr, arg):
    def pad4(b):
        r = len(b) % 4
        return b if r == 0 else b + b'\x00' * (4 - r)
    a = pad4(addr.encode() + b'\x00')
    return a + b',s\x00\x00' + pad4(arg.encode() + b'\x00')

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setblocking(0)
try:
    s.connect((target_console_ip, 3037))  # the console's own OSC TCP port
except socket.error:
    pass
_, writable, _ = select.select([], [s], [s], 3.0)
s.setblocking(1)

# One combined newcmd per cue, "Enter" (not "#") between actions. No
# "Record Cue" — "Cue <list>/<num> Time .. Delay .." both creates the cue
# if it's new AND edits it if it already exists; the double Enter dismisses
# the create-confirmation dialog either way. Confirmed working.
s.sendall(slip_wrap(osc_str_msg('/eos/newcmd',
    "Cue 601 / 4 Time 0 Delay 0 Enter Enter "
    "Chan 6001 Block Enter "
    "Chan 6001 _Cue 00 Cue_2 04 Cue_3 60 Enter")))

# Label and scene are direct property writes, not typed through the
# command line — a pure rename only needs this, nothing above.
s.sendall(slip_wrap(osc_str_msg('/eos/set/cue/601.0/4/label', 'My Label')))
s.sendall(slip_wrap(osc_str_msg('/eos/set/cue/601.0/4/scene', 'My Scene')))

import time
time.sleep(0.2)   # let Eos finish before tearing down the connection
s.close()
```

## What doesn't work

```python
# ❌ UDP to a Client console — silently accepted by nothing
sock.sendto(osc_packet, (client_console_ip, 8000))

# ❌ Separate messages relying on trailing '#' — nothing gets recorded
send('/eos/newcmd', 'Chan 6001 _Cue 00 Cue_2 04 Cue_3 60#')
send('/eos/newcmd', 'Record Cue 601 / 4#')

# ❌ Inventing a probe address to synchronise the close — Eos may react to
# an unrecognised address by killing the connection instead of replying
sock.sendall(slip_wrap(osc_no_args_msg('/eos/get/version')))
select.select([sock], [], [], 2.0)  # returns almost instantly, EOF not data

# ❌ Referencing a new cue with only ONE Enter after Time/Delay — this
# looked like a hard failure but was actually a missed confirmation dialog
# (see item 9): Eos's own log showed "Syntax: Cue 601 / 48 >>Error : Cue
# Does Not Exist". Needs a SECOND Enter, not "Record Cue", to fix:
send('/eos/newcmd', 'Cue 601 / 48 Time 0 Delay 0 Enter')  # missing 2nd Enter
# Eos diagnostic log: Syntax: Cue 601 / 48 >>Error : Cue Does Not Exist

# ❌ Comparing labels without normalising quotes on both sides
hit.label == expected.label.replace('"', "'")  # 'Twiggy' != "Twiggy"
```

## Related

See [disguise-docs-as-source-of-truth.md](disguise-docs-as-source-of-truth.md)
— the same methodology applies to
third-party protocols, not just Disguise's own API: ETC's documented
"OSC must go to Host" restriction turned out to apply specifically to UDP,
which only packet-capturing a known-working tool revealed.

