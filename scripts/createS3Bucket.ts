/**
 * Create S3 bucket for session storage
 *
 * Usage: npx ts-node scripts/createS3Bucket.ts
 */

import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const S3_BUCKET = process.env.S3_BUCKET || 'dopamint-test-assets';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';

async function createBucket() {
    console.log('\n========================================');
    console.log('🪣 CREATE S3 BUCKET');
    console.log('========================================\n');

    console.log(`🌍 Region: ${AWS_REGION}`);
    console.log(`🪣 Bucket: ${S3_BUCKET}`);

    const s3Client = new S3Client({ region: AWS_REGION });

    // Check if bucket already exists
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
        console.log('\n✅ Bucket already exists!');
        return;
    } catch (error: any) {
        if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) {
            // Some other error (maybe access denied)
            if (error.$metadata?.httpStatusCode === 403) {
                console.log('\n✅ Bucket exists (owned by another account or you)');
                return;
            }
            throw error;
        }
        // Bucket doesn't exist, continue to create
    }

    console.log('\n🚀 Creating bucket...');

    try {
        // For ap-southeast-1 and most regions, need LocationConstraint
        const createParams: any = {
            Bucket: S3_BUCKET,
        };

        // us-east-1 doesn't need LocationConstraint
        if (AWS_REGION !== 'us-east-1') {
            createParams.CreateBucketConfiguration = {
                LocationConstraint: AWS_REGION,
            };
        }

        await s3Client.send(new CreateBucketCommand(createParams));

        console.log('\n✅ Bucket created successfully!');
        console.log(`\n📍 Bucket URL: https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`);
        console.log('\nNext step: Upload session file:');
        console.log('  npx ts-node scripts/uploadSessionToS3.ts');
    } catch (error: any) {
        console.error('❌ Failed to create bucket:', error.message);

        if (error.name === 'BucketAlreadyExists') {
            console.log('\n⚠️ This bucket name is taken globally.');
            console.log('Try a different name in .env.test (S3_BUCKET)');
        } else if (error.name === 'BucketAlreadyOwnedByYou') {
            console.log('\n✅ Bucket already exists and owned by you!');
        }

        process.exit(1);
    }
}

createBucket();
