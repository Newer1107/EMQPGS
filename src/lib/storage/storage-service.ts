import { prisma } from "@/lib/db";
import { MinioProvider } from "@/lib/storage/minio-provider";
import { AppError } from "@/lib/errors";

const allowedBuckets = [
  "question-bank-attachments",
  "generated-papers",
  "exports",
  "audit-files",
  "system-backups",
] as const;

export class StorageService {
  private readonly provider = new MinioProvider();

  async createUploadLink(input: {
    bucket: (typeof allowedBuckets)[number];
    fileName: string;
    mimeType: string;
    size: number;
    uploadedById?: string | null;
  }) {
    if (!allowedBuckets.includes(input.bucket)) {
      throw new AppError("Invalid storage bucket", 400);
    }

    const objectKey = `${Date.now()}-${input.fileName.replace(/\s+/g, "-")}`;
    const url = await this.provider.createPresignedPutUrl(input.bucket, objectKey, input.mimeType);

    const asset = await prisma.fileAsset.create({
      data: {
        bucket: input.bucket,
        objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        uploadedById: input.uploadedById ?? null,
      },
    });

    return { uploadUrl: url, asset };
  }

  async createDownloadLink(fileAssetId: string) {
    const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
    if (!asset) {
      throw new AppError("File asset not found", 404);
    }

    return {
      downloadUrl: await this.provider.createPresignedGetUrl(asset.bucket, asset.objectKey),
      asset,
    };
  }

  async uploadServerFile(input: {
    bucket: (typeof allowedBuckets)[number];
    fileName: string;
    mimeType: string;
    body: Uint8Array | Buffer | string;
    size: number;
    uploadedById?: string | null;
  }) {
    if (!allowedBuckets.includes(input.bucket)) {
      throw new AppError("Invalid storage bucket", 400);
    }

    const objectKey = `${Date.now()}-${input.fileName.replace(/\s+/g, "-")}`;
    await this.provider.uploadObject(input.bucket, objectKey, input.body, input.mimeType);

    return prisma.fileAsset.create({
      data: {
        bucket: input.bucket,
        objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        uploadedById: input.uploadedById ?? null,
      },
    });
  }

  async createDownloadLinkForAsset(asset: { id: string; bucket: string; objectKey: string; fileName: string; mimeType: string }) {
    return {
      downloadUrl: await this.provider.createPresignedGetUrl(asset.bucket, asset.objectKey),
      asset,
    };
  }

  async deleteAsset(fileAssetId: string) {
    const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
    if (!asset) return null;
    await this.provider.deleteObject(asset.bucket, asset.objectKey);
    await prisma.fileAsset.delete({ where: { id: fileAssetId } });
    return asset;
  }

  async checkBucketHealth(bucket: (typeof allowedBuckets)[number]) {
    return this.provider.headBucket(bucket);
  }
}
