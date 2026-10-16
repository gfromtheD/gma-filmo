# PeerTube adapter contract (pre-VPS)

The PeerTube integration is deliberately server-only and disabled until a VPS instance is configured. The implementation targets the official PeerTube REST contract reviewed for v8.3.1. This folder documents the adapter boundary; it does not install, provision, or contact an instance.

## Local and future configuration

`PEERTUBE_PROVIDER_ENABLED` must remain `false` before a real instance is explicitly configured. `PEERTUBE_BASE_URL`, `PEERTUBE_USERNAME`, `PEERTUBE_PASSWORD`, `PEERTUBE_CHANNEL_ID`, and OAuth credentials are server secrets/configuration and must never use a `NEXT_PUBLIC_` prefix or enter a browser bundle, DTO, or owner-readable database row. The adapter validates the instance's HLS/tracker configuration and configured technical channel before admission. The mock/local path has no PeerTube dependency.

## REST boundary

The client uses `/api/v1/oauth-clients/local`, `/api/v1/users/token`, `/api/v1/config`, `/api/v1/users/me`, resumable upload init and `Content-Range` offset operations, private video details/token, and deletion. It enforces 10-second request timeouts, disables redirect following, allowlists resumable `Location` to the configured origin and upload endpoint, and does not automatically repeat an uncertain upload-init POST. OAuth is held only in server memory; file tokens are returned to the provider process only and must be consumed by the future media gateway.

PeerTube upload transport is uploadx-style `Content-Range`, not tus. GMA must spool and hash the full input before finalizing upstream bytes. The browser receives only a short-lived GMA gateway capability and never receives PeerTube OAuth or its private file token.

## Playback, state, and privacy

New videos are created as PeerTube `private` (privacy id 3), with no automatic PeerTube publication or federation. PeerTube state 1 is only a candidate for GMA READY; receipt, full-byte SHA, duration, and valid HLS references are also required. Unknown states cannot become READY. The adapter returns GMA playback paths, keeps P2P disabled, and rejects PeerTube auxiliary-media delivery; auxiliary assets use R2 or Mock as chosen by the reservation.

## VPS work intentionally pending

Installing PeerTube/PostgreSQL/Redis/FFmpeg, HTTPS/reverse proxy, account creation, CORS, storage sizing, uploadx gateway forwarding, private HLS rewriting, P2P, real instance contract tests, backup/restore, and concurrency certification belong to the VPS phase. No capacity claim is made by local fixture tests.


## V.1 preflight record (2026-10-11)

See `docs/media/V1-PREFLIGHT.md`. The official v8.3.1 tar.xz was downloaded **only locally**, hashed and matched against the GitHub release API digest; no installation or extraction. `reference/v8.3.1/RELEASE-VERIFIED.json` records full commit/tag, artifact SHA, official origins and current config comparisons. Cached JSON-schema formatting differs from upstream bytes while the parsed objects are identical; both hashes are kept. Original cached provenance remains unchanged.

The tag declares pnpm >=10.9 and packageManager10.15.1. Apply these stricter requirements alongside the versioned dependencies guide; do not install from an unpinned latest release. GitHub reports verified tag/commit signatures; detached GPG signature has not been locally verified. Authenticated VPS inspection now records Ubuntu24.04.5/x86_64/KVM, 8vCPU, 15.25GiB RAM and 231.44GiB root filesystem; UFW is inactive and iptables accepts traffic. The user explicitly authorized the dedicated encrypted client key and gmaadmin/sudo setup; key-only SSH and real sudo were verified, preserving root/firewall/sshd policy. Server identity is pinned using user-accepted TOFU and **independent provider verification remains pending**. The explicitly authorized LOCAL saved-backup restore now passes public/Auth data, policies/ACL, objects, private HLS video/audio decoding and original-unchanged checks; no new Auth HTTP runtime was started. Provider snapshots/external restore and approved staging/domain remain pending. The current user-reported frontend address is gma-filmo.vercel.app; no custom domain is confirmed and no DNS/TLS/exposure change is authorized. Providers/P2P stay off; no V.2 action is authorized by this record.


## Private recoverable lab proposal (2026-10-11)

Definitive external backups are deferred by explicit user decision D-VPS-TEST-01, not implemented. The completed LOCAL restore and private 544-source snapshot are retained without rerunning it. See `docs/media/BACKUPS-FUTUROS.md` (home Linux400GB/SSH/Restic, B2 critical data) and `docs/media/V2-PREPARACION-PRIVADA.md`.

EX-VPS-PRIVATE-01 proposes private V.2–V.4 with V.1 still open; **approval pending**, not an execution grant. Independent host verification and operation-specific access/firewall/package approvals remain prerequisites. `private-lab.yaml.example`/offline validator are non-deployable preparation only, bind127.0.0.1, no public80/443/P2P. PeerTube lab is disposable; do not rename its identity into the eventual public domain. Public steps and GMA real integration remain unexecuted. Before real R2/V.13, require a verified complete backup and rollback.
