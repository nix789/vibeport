# Vibeport — Privacy Policy
## "The Null Policy"

*Effective immediately and permanently.*

---

### § 1 — We Don't Know You

Vibeport does not collect your email address, phone number, IP address,
physical location, device fingerprint, or any other identifying information.

We cannot collect this data because there is no "we" with a server to collect
it. Your metadata — profile, posts, friends list, stickers, webring
memberships — lives in your local `./vibeport_node/data/` folder and nowhere
else.

---

### § 2 — Zero Tracking

There are no tracking pixels on this page.
There are no analytics scripts.
There are no third-party SDKs phoning home.
There are no cookies set by Vibeport.
There is no "behavioral analysis."
There is no ad targeting, because there are no ads, because there are no
targets — we are all just Ports.

If you inspect the network tab of your browser while using Vibeport, you will
see requests to exactly one destination: `127.0.0.1:7331` — your own machine.

---

### § 3 — Data Portability (You Already Have It)

You don't need to submit a "data export request" and wait 30 days.

You are currently holding all of your data. It is in the folder you installed
Vibeport into. You can copy it, back it up to a USB drive, or move it to a
new machine by dragging a folder.

**To delete your account:** delete the `./vibeport_node/data/` folder.
That is the complete and total deletion of everything Vibeport knows about you.
There is no additional step. There is no "we'll process your request within
90 days." The data is gone the moment you empty the trash.

---

### § 4 — What Your Peers See

When you add a friend, you share your Hypercore public key with them.
They can replicate your public profile log. Everything in your public profile
(handle, bio, posts, custom CSS) is intentionally public to the peers you
connect with.

Your secret key never leaves your device. It is stored at
`data/identity.json` with file permissions set to owner-read-only (`0600`).

---

*This policy is complete. There is nothing hidden in footnotes.*
