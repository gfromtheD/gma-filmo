import { createHmac, createPrivateKey, createSign, timingSafeEqual } from "node:crypto";
import type { UploadSession, VideoObservation } from "./types";

export class ProviderError extends Error {
  constructor(public readonly code: string, public readonly uncertain = false) { super(code); }
}
type StreamVideo = { uid: string; creator?: string; meta?: Record<string, string>; readyToStream?: boolean;
  size?: number; duration?: number; status?: { state?: string; pctComplete?: string | number } };
export function streamObservation(video: StreamVideo): VideoObservation {
  const progress = Number(video.status?.pctComplete);
  const ready = video.readyToStream === true && video.status?.state === "ready" && progress === 100;
  return { found: true, state: video.status?.state === "error" ? "rejected" : ready ? "ready" : "processing",
    readyToStream: video.readyToStream === true, processingProgress: Number.isFinite(progress) ? progress : 0,
    durationSeconds: typeof video.duration === "number" && Number.isFinite(video.duration) ? video.duration : null,
    providerReportedSize: typeof video.size === "number" ? video.size : null, receivedBytes: null };
}
export function verifyStreamSignature(raw: Uint8Array, signature: string | null, secret: string, now = Date.now()): boolean {
  if (!signature || !secret) return false;
  const fields = Object.fromEntries(signature.split(",").map(p => p.trim().split("=")));
  const timestamp = fields.time;
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(fields.sig1 ?? "")) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(raw).digest();
  const actual = Buffer.from(fields.sig1!, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class StreamProvider {
  constructor(private config: { accountId: string; streamToken: string; streamCustomer: string },
    private fetcher: typeof fetch = fetch) {}
  private base() { return "https://api.cloudflare.com/client/v4/accounts/" + this.config.accountId + "/stream"; }
  private async request(path: string, init: RequestInit = {}) {
    try {
      return await this.fetcher(this.base() + path, { ...init, cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(25000),
        headers: { Authorization: "Bearer " + this.config.streamToken, ...init.headers } });
    } catch { throw new ProviderError("STREAM_NETWORK_UNCERTAIN", init.method === "POST"); }
  }
  async provision(session: UploadSession) {
    const metadata = { name: "gma-upload-" + session.id, gma_session: session.id,
      expiry: session.expires_at, maxDurationSeconds: String(session.max_duration_seconds) };
    const header = Object.entries(metadata).map(([k,v]) => k + " " + Buffer.from(v).toString("base64")).join(",") + ",requiresignedurls";
    const response = await this.request("?direct_user=true", { method: "POST", headers: {
      "Tus-Resumable": "1.0.0", "Upload-Length": String(session.expected_input_bytes),
      "Upload-Metadata": header, "Upload-Creator": session.owner_id } });
    if (!response.ok) throw new ProviderError("STREAM_PROVISION_FAILED", response.status >= 500);
    const providerRef = response.headers.get("stream-media-id");
    const uploadUrl = response.headers.get("Location");
    if (!providerRef || !/^[a-zA-Z0-9_-]{16,128}$/.test(providerRef) || !uploadUrl) throw new ProviderError("STREAM_PROVISION_UNCERTAIN", true);
    this.assertTransferUrl(uploadUrl);
    return { providerRef, uploadUrl, expiresAt: session.expires_at };
  }
  assertTransferUrl(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password || !/^(?:[a-z0-9-]+\.)?(?:videodelivery\.net|cloudflarestream\.com)$/.test(parsed.hostname))
      throw new ProviderError("STREAM_TRANSFER_URL_INVALID");
  }
  async recover(session: UploadSession): Promise<string | null> {
    // Never reprovision after an uncertain external result. Reconcile correlation first.
    const response = await this.request("?creator=" + encodeURIComponent(session.owner_id) + "&search=" + encodeURIComponent("gma-upload-" + session.id));
    if (!response.ok) throw new ProviderError("STREAM_RECONCILE_FAILED");
    const data = await response.json() as { result?: StreamVideo[]; success?: boolean };
    if(data.success===false || !Array.isArray(data.result))throw new ProviderError("STREAM_RESPONSE_INVALID");
    const matches = data.result?.filter(v => v.creator === session.owner_id && v.meta?.name === "gma-upload-" + session.id) ?? [];
    if (matches.length > 1) throw new ProviderError("STREAM_DUPLICATE_REQUIRES_REVIEW");
    return matches[0]?.uid ?? null;
  }
  async observe(ref: string): Promise<VideoObservation> {
    const response = await this.request("/" + encodeURIComponent(ref));
    if (response.status === 404) return { found: false, state: "pending", readyToStream: false, processingProgress: 0, durationSeconds: null, providerReportedSize: null, receivedBytes: null };
    if (!response.ok) throw new ProviderError("STREAM_OBSERVE_FAILED");
    const data = await response.json() as { result: StreamVideo; success: boolean };
    if (!data.success || data.result.uid !== ref) throw new ProviderError("STREAM_RESPONSE_INVALID");
    return streamObservation(data.result);
  }
  async received(session: UploadSession): Promise<number | null> {
    const url = session.provider_data.uploadUrl;
    if (typeof url !== "string") return null;
    this.assertTransferUrl(url);
    const response = await this.fetcher(url, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const length = Number(response.headers.get("Upload-Length"));
    const offset = Number(response.headers.get("Upload-Offset"));
    return length === session.expected_input_bytes && offset === length ? length : null;
  }
  async delete(ref: string): Promise<boolean> {
    const response = await this.request("/" + encodeURIComponent(ref), { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new ProviderError("STREAM_DELETE_FAILED");
    return !(await this.observe(ref)).found;
  }
  playback(ref: string, duration: number) {
    const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
    const keyValue = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;
    if (!keyId || !keyValue) throw new ProviderError("STREAM_SIGNING_CONFIG_MISSING");
    const expires = Math.floor(Date.now()/1000) + Math.min(86400, Math.max(7200, Math.ceil(duration)+3600));
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const input = encode({alg:"RS256",kid:keyId}) + "." + encode({sub:ref,kid:keyId,exp:expires});
    const pem=keyValue.startsWith("-----")?keyValue.replace(/\\n/g,"\n"):Buffer.from(keyValue,"base64").toString("utf8");
    const key = createPrivateKey(pem);
    const token = input + "." + createSign("RSA-SHA256").update(input).sign(key).toString("base64url");
    return { url: "https://customer-" + this.config.streamCustomer + ".cloudflarestream.com/" + token + "/manifest/video.m3u8", expiresAt: expires*1000 };
  }
}
