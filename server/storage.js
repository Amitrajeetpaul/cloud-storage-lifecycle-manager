import { Client } from 'minio';
import { TIER_ORDER } from './engine/costEngine.js';

const BUCKET_PREFIX = process.env.MINIO_BUCKET_PREFIX || 'cslm';

export function bucketForTier(tier) {
  return `${BUCKET_PREFIX}-${tier.toLowerCase()}`;
}

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

/**
 * Real object bytes are a small placeholder blob, not `size_mb` worth of
 * data — size_mb is simulated metadata (tracked in SQLite) so the demo can
 * model multi-GB objects without actually writing that much to disk.
 * What's real: the bucket residency, and every copy/move/delete across tiers.
 */
function placeholderBuffer(object) {
  return Buffer.from(
    `Simulated object placeholder\nname: ${object.name}\nsize_mb: ${object.size_mb}\nid: ${object.id}\n`
  );
}

export async function ensureBucketsExist() {
  for (const tier of TIER_ORDER) {
    const bucket = bucketForTier(tier);
    const exists = await minioClient.bucketExists(bucket).catch(() => false);
    if (!exists) await minioClient.makeBucket(bucket);
  }
}

/**
 * Stores an object. By default (no `file`) it's a synthetic/seeded object
 * and gets the small placeholder blob — `size_mb` is simulated metadata,
 * not real bytes. When `file` is supplied (a real upload — see
 * routes/objects.js `POST /upload`), the actual file bytes and content
 * type are stored for real, and can be retrieved later via getObjectStream.
 */
export async function putObject(object, file) {
  const bucket = bucketForTier(object.tier);
  const buffer = file ? file.buffer : placeholderBuffer(object);
  const metadata = {
    'x-amz-meta-name': object.name,
    'x-amz-meta-size-mb': String(object.size_mb),
    ...(file?.mimetype ? { 'Content-Type': file.mimetype } : {}),
  };
  await minioClient.putObject(bucket, object.id, buffer, buffer.length, metadata);
}

export async function getObjectStream(objectId, tier) {
  const bucket = bucketForTier(tier);
  return minioClient.getObject(bucket, objectId);
}

export async function moveObject(objectId, fromTier, toTier) {
  const fromBucket = bucketForTier(fromTier);
  const toBucket = bucketForTier(toTier);
  await minioClient.copyObject(toBucket, objectId, `/${fromBucket}/${objectId}`);
  await minioClient.removeObject(fromBucket, objectId);
}

export async function removeObject(objectId, tier) {
  const bucket = bucketForTier(tier);
  await minioClient.removeObject(bucket, objectId).catch(() => {});
}

export async function checkConnection() {
  await minioClient.listBuckets();
}

export default minioClient;
