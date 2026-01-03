/**
 * Upload Google session file to S3
 *
 * Prerequisites:
 * - AWS credentials configured (~/.aws/credentials or environment variables)
 * - S3 bucket created
 *
 * Usage: npx ts-node scripts/uploadSessionToS3.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const SESSION_FILE = path.resolve(__dirname, '../auth/googleSession.json');
const S3_BUCKET = process.env.S3_BUCKET || 'dopamint-test-assets';
const S3_KEY = process.env.S3_SESSION_KEY || 'playwright/googleSession.json';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';

async function uploadSession() {
    console.log('\n========================================');
    console.log('📤 UPLOAD SESSION TO S3');
    console.log('========================================\n');

    // Check if session file exists
    if (!fs.existsSync(SESSION_FILE)) {
        console.error('❌ Session file not found:', SESSION_FILE);
        console.log('\nRun this first: npx ts-node scripts/setupGoogleSessionAuto.ts');
        process.exit(1);
    }

    const fileContent = fs.readFileSync(SESSION_FILE);
    const stats = fs.statSync(SESSION_FILE);

    console.log(`📁 Session file: ${SESSION_FILE}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📅 Last modified: ${stats.mtime.toISOString()}`);
    console.log(`🌍 Region: ${AWS_REGION}`);
    console.log(`🪣 Bucket: ${S3_BUCKET}`);
    console.log(`🔑 Key: ${S3_KEY}`);

    // Create S3 client
    const s3Client = new S3Client({ region: AWS_REGION });

    console.log(`\n🚀 Uploading to s3://${S3_BUCKET}/${S3_KEY}...`);

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY,
            Body: fileContent,
            ContentType: 'application/json',
            ServerSideEncryption: 'AES256',
        }));

        console.log('\n✅ Upload successful!');
        console.log(`\n📍 S3 URI: s3://${S3_BUCKET}/${S3_KEY}`);
        console.log('\nCodeBuild will auto-download this file before tests.');
    } catch (error: any) {
        console.error('❌ Upload failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. AWS credentials are configured (~/.aws/credentials)');
        console.log('2. S3 bucket exists: ' + S3_BUCKET);
        console.log('3. You have s3:PutObject permission');
        process.exit(1);
    }
}

uploadSession();
