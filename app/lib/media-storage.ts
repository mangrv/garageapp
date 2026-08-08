import path from "path";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type MediaArea =
  | "jobs/photos"
  | "jobs/attachments"
  | "jobs/task-photos"
  | "cars/gallery"
  | "cars/documents"
  | "receipts"
  | "service-records/attachments"
  | "posts/media";

function safeExt(inputName?: string, fallback = "bin") {
  const ext = (inputName?.split(".").pop() || fallback).toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "") || fallback;
}

export function isS3Enabled() {
  return Boolean(process.env.AWS_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export function getS3PublicUrl(key: string) {
  const bucket = process.env.AWS_BUCKET!;
  const region = process.env.AWS_REGION || "us-east-1";
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function getSignedReadUrl(key: string, expiresInSeconds?: number) {
  const bucket = process.env.AWS_BUCKET;
  if (!bucket) throw new Error("AWS_BUCKET is required for signed URLs");

  const expires = Number(process.env.AWS_SIGNED_URL_EXPIRES || expiresInSeconds || 600);

  return getSignedUrl(getS3Client(), new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }), {
    expiresIn: Number.isFinite(expires) ? expires : 600,
  });
}

let s3Client: S3Client | null = null;
function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function buildUserMediaPath(args: {
  userId: string;
  area: MediaArea;
  entityId: string;
  originalName?: string;
  forceExt?: string;
}) {
  const ext = (args.forceExt || safeExt(args.originalName)).toLowerCase();
  const relPath = `users/${args.userId}/${args.area}/${args.entityId}/${randomUUID()}.${ext}`;
  const absPath = path.join(process.cwd(), "public", "uploads", relPath);
  await mkdir(path.dirname(absPath), { recursive: true });
  return { relPath, absPath };
}

export async function persistMedia(args: {
  relPath: string;
  absPath: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const meta = {
    relPath: args.relPath,
    absPath: args.absPath,
    bytes: args.buffer.length,
    contentType: args.contentType || "application/octet-stream",
    s3Enabled: isS3Enabled(),
  };

  console.log("[upload] persistMedia:start", meta);

  if (meta.s3Enabled) {
    try {
      await getS3Client().send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: args.relPath,
        Body: args.buffer,
        ContentType: meta.contentType,
        ACL: process.env.AWS_ACL as "private" | "public-read" | undefined,
        ServerSideEncryption: "AES256",
      }));
      console.log("[upload] persistMedia:success", { backend: "s3", relPath: args.relPath, bytes: args.buffer.length });
      return { backend: "s3" as const };
    } catch (error) {
      console.error("[upload] persistMedia:error", {
        backend: "s3",
        relPath: args.relPath,
        bytes: args.buffer.length,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      });
      throw error;
    }
  }

  try {
    await writeFile(args.absPath, args.buffer);
    console.log("[upload] persistMedia:success", { backend: "local", relPath: args.relPath, absPath: args.absPath, bytes: args.buffer.length });
    return { backend: "local" as const };
  } catch (error) {
    console.error("[upload] persistMedia:error", {
      backend: "local",
      relPath: args.relPath,
      absPath: args.absPath,
      bytes: args.buffer.length,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });
    throw error;
  }
}

export async function readMedia(args: { relPath: string; absPath: string }) {
  if (isS3Enabled()) {
    const res = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: args.relPath,
    }));
    if (!res.Body) throw new Error("S3 object body is empty");
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(args.absPath);
}

export async function deleteMedia(args: { relPath: string; absPath: string }) {
  if (isS3Enabled()) {
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: args.relPath,
    }));
    return;
  }

  await unlink(args.absPath);
}

export async function mediaExists(args: { relPath: string; absPath: string }) {
  if (isS3Enabled()) {
    try {
      await getS3Client().send(new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: args.relPath,
      }));
      return true;
    } catch {
      return false;
    }
  }

  try {
    await readFile(args.absPath);
    return true;
  } catch {
    return false;
  }
}
