# PeerTube v8.3.1 contract fixtures

These are sanitized contract fixtures based on the official PeerTube v8.3.1 API and source. They contain no real account, upload or file token. `TEST_ONLY_REDACTED_FILE_TOKEN` is a non-secret sentinel. The hostnames and UUIDs are reserved test data.

The request shapes are grounded in the versioned [REST API reference](https://docs.joinpeertube.org/api-rest-reference.html), the [v8.3.1 REST/OpenAPI source](https://github.com/Chocobozzz/PeerTube/tree/v8.3.1/packages/server), and the [v8.3.1 configuration](https://github.com/Chocobozzz/PeerTube/blob/v8.3.1/config/default.yaml). Relevant routes: `GET /api/v1/config`, `GET /api/v1/users/me`, `POST /api/v1/videos/upload-resumable`, `PUT` to its `Location`, `DELETE` that location, `GET /api/v1/videos/{uuid}`, `POST /api/v1/videos/{uuid}/token`, and `DELETE /api/v1/videos/{uuid}`.

`uploadx.json` records the resume contract (`PUT` with an empty body and `Content-Range: bytes */TOTAL`, `308` plus the confirmed `Range`, then final `200` plus the video UUID). This is separate from PeerTube's `tus` API. A `404` after an uncertain final response is ambiguous; production recovery inspects the account/channel correlation before considering a new upload.

`video-states.json` preserves IDs 1–12 and one unknown value. Only ID 1 is a candidate for READY, and only after receipt, duration and private HLS verification. Unknown IDs never become READY. The fixture's metadata is synthetic and does not claim a PeerTube instance was contacted.

`sha256sums.txt` contains fixture-file digests for integrity checking. These digests authenticate the local fixture bytes; they are not presented as checksums of upstream source files.
