import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export type MediaKind = 'image' | 'document' | 'video';

export interface UploadedMedia {
    url: string;
    filename: string;
    contentType: string;
    size: number;
    kind: MediaKind;
}

const MB = 1024 * 1024;

const KIND_RULES: Record<MediaKind, { types: string[]; maxSize: number }> = {
    image: {
        types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        maxSize: 10 * MB,
    },
    document: {
        types: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
        ],
        maxSize: 25 * MB,
    },
    video: {
        types: ['video/mp4', 'video/webm', 'video/quicktime'],
        maxSize: 100 * MB,
    },
};

export const MAX_UPLOAD_SIZE = 100 * MB;

@Injectable()
export class MediaService {
    private client: S3Client | null = null;

    constructor(private readonly configService: ConfigService) { }

    private get bucket(): string | undefined {
        return this.configService.get<string>('S3_BUCKET') || this.configService.get<string>('AWS_S3_BUCKET');
    }

    private get region(): string {
        return this.configService.get<string>('S3_REGION') || this.configService.get<string>('AWS_REGION') || 'us-east-1';
    }

    /** Custom S3-compatible endpoint (e.g. MinIO); empty means real AWS S3. */
    private get endpoint(): string | undefined {
        return this.configService.get<string>('S3_ENDPOINT_URL')?.replace(/\/$/, '') || undefined;
    }

    private getClient(): S3Client {
        if (this.client) return this.client;
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        if (!this.bucket) {
            throw new InternalServerErrorException('Media storage is not configured (S3_BUCKET)');
        }
        this.client = new S3Client({
            region: this.region,
            ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
            ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
        });
        return this.client;
    }

    private publicBaseUrl(): string {
        const explicit = this.configService.get<string>('S3_PUBLIC_BASE_URL');
        if (explicit) return explicit.replace(/\/$/, '');
        if (this.endpoint) return `${this.endpoint}/${this.bucket}`;
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    }

    private detectKind(contentType: string): MediaKind | null {
        for (const kind of Object.keys(KIND_RULES) as MediaKind[]) {
            if (KIND_RULES[kind].types.includes(contentType)) return kind;
        }
        return null;
    }

    async upload(file: Express.Multer.File, userId: string): Promise<UploadedMedia> {
        if (!file) throw new BadRequestException('No file provided');

        const kind = this.detectKind(file.mimetype);
        if (!kind) throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
        if (file.size > KIND_RULES[kind].maxSize) {
            throw new BadRequestException(`File too large. Max ${KIND_RULES[kind].maxSize / MB}MB for ${kind}s`);
        }

        const client = this.getClient();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `email-media/${userId}/${randomUUID()}-${safeName}`;

        await client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ContentDisposition: kind === 'document' ? `inline; filename="${safeName}"` : undefined,
            }),
        );

        return {
            url: `${this.publicBaseUrl()}/${key}`,
            filename: file.originalname,
            contentType: file.mimetype,
            size: file.size,
            kind,
        };
    }
}
