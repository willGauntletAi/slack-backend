import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsConfig } from '../config/aws';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
    region: awsConfig.AWS_REGION,
    credentials: {
        accessKeyId: awsConfig.AWS_ACCESS_KEY_ID,
        secretAccessKey: awsConfig.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});

// Maximum allowed expiration time for presigned URLs is 7 days (604800 seconds)
const MAX_PRESIGNED_URL_EXPIRATION = 604800;

export async function generateUploadUrl(fileName: string, contentType?: string): Promise<{ url: string; key: string }> {
    console.log('Using AWS credentials:', {
        accessKeyId: awsConfig.AWS_ACCESS_KEY_ID,
        bucket: awsConfig.AWS_S3_BUCKET,
        region: awsConfig.AWS_REGION
    });

    const key = `uploads/${uuidv4()}-${fileName}`;
    const command = new PutObjectCommand({
        Bucket: awsConfig.AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
    });
    return { url, key };
}

export async function generateDownloadUrl(key: string): Promise<string> {
    // Extract original filename from the key by removing "uploads/" prefix and UUID pattern
    // UUID pattern is 32 hex digits with hyphens (8-4-4-4-12 format) plus the trailing hyphen
    const originalFileName = key.replace(/^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '');

    const command = new GetObjectCommand({
        Bucket: awsConfig.AWS_S3_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${originalFileName}"`,
    });

    return getSignedUrl(s3Client, command, { expiresIn: MAX_PRESIGNED_URL_EXPIRATION });
} 