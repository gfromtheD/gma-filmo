export const uploadEngineEnabled = () => process.env.UPLOAD_ENGINE_V2 === "true";
export const videoProvider = () => {
  const value = process.env.VIDEO_PROVIDER ?? 'r2';
  if (value !== 'r2' && value !== 'stream') throw new Error('UPLOAD_VIDEO_PROVIDER_INVALID');
  if (value === 'stream' && process.env.STREAM_PROVIDER_ENABLED !== 'true') throw new Error('UPLOAD_STREAM_DISABLED');
  return value;
};
export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || /^(?:\[?redacted\]?|sensitive|<.*>)$/i.test(value)) throw new Error(`UPLOAD_CONFIG_MISSING:${name}`);
  return value;
}
export function getStreamConfig() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const streamCustomer = requiredEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE');
  if (!/^[a-f0-9]{32}$/.test(accountId) || !/^[a-z0-9-]+$/.test(streamCustomer)) throw new Error('UPLOAD_CUSTOMER_INVALID');
  return {accountId, streamCustomer, streamToken: requiredEnv('CLOUDFLARE_STREAM_API_TOKEN')};
}
export function getUploadConfig() {
  const environment = requiredEnv("UPLOAD_ENVIRONMENT");
  if (!["local", "staging", "production"].includes(environment)) throw new Error("UPLOAD_ENVIRONMENT_INVALID");
  if (environment === "production" && process.env.UPLOAD_PRODUCTION_READY !== "true") throw new Error("UPLOAD_PRODUCTION_GATE_CLOSED");
  if (environment !== "production" && process.env.UPLOAD_ISOLATION_ACK !== "true") throw new Error("UPLOAD_ISOLATION_REQUIRED");
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("UPLOAD_ACCOUNT_INVALID");
  const bucket = requiredEnv("UPLOAD_R2_PRIVATE_BUCKET");
  if (bucket === (process.env.CLOUDFLARE_R2_BUCKET ?? "gma-media")) throw new Error("UPLOAD_INGEST_BUCKET_MUST_BE_SEPARATE");
  return {environment, accountId, bucket};
}
