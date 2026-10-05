export const uploadEngineEnabled = () => process.env.UPLOAD_ENGINE_V2 === "true";
export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || /^(?:\[?redacted\]?|sensitive|<.*>)$/i.test(value)) throw new Error(`UPLOAD_CONFIG_MISSING:${name}`);
  return value;
}
export function getUploadConfig() {
  const environment = requiredEnv("UPLOAD_ENVIRONMENT");
  if (!["local", "staging", "production"].includes(environment)) throw new Error("UPLOAD_ENVIRONMENT_INVALID");
  if (environment === "production" && process.env.UPLOAD_PRODUCTION_READY !== "true") throw new Error("UPLOAD_PRODUCTION_GATE_CLOSED");
  if (environment !== "production" && process.env.UPLOAD_ISOLATION_ACK !== "true") throw new Error("UPLOAD_ISOLATION_REQUIRED");
  if (requiredEnv("UPLOAD_STREAM_POLICY_ACK") !== "1080p-sdr-stereo-no-master") throw new Error("UPLOAD_STREAM_POLICY_REQUIRED");
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("UPLOAD_ACCOUNT_INVALID");
  const streamCustomer = requiredEnv("CLOUDFLARE_STREAM_CUSTOMER_CODE");
  if (!/^[a-z0-9-]+$/.test(streamCustomer)) throw new Error("UPLOAD_CUSTOMER_INVALID");
  const bucket = requiredEnv("UPLOAD_R2_PRIVATE_BUCKET");
  if (bucket === (process.env.CLOUDFLARE_R2_BUCKET ?? "gma-media")) throw new Error("UPLOAD_INGEST_BUCKET_MUST_BE_SEPARATE");
  return { environment, accountId, streamCustomer, bucket, streamToken: requiredEnv("CLOUDFLARE_STREAM_API_TOKEN") };
}
