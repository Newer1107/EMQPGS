import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export class S3CompatibleProvider {
  protected readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: `${env.MINIO_USE_SSL ? "https" : "http"}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
      region: env.MINIO_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
      },
    });
  }

  async createPresignedPutUrl(bucket: string, objectKey: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: env.SIGNED_URL_EXPIRY_SECONDS });
  }

  async createPresignedGetUrl(bucket: string, objectKey: string) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    return getSignedUrl(this.client, command, { expiresIn: env.SIGNED_URL_EXPIRY_SECONDS });
  }

  async uploadObject(bucket: string, objectKey: string, body: Uint8Array | Buffer | string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  async deleteObject(bucket: string, objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }

  async headBucket(bucket: string) {
    await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  }
}
