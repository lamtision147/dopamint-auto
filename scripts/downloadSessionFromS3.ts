/**
 * Download Google session file from S3
 *
 * This script is meant to run on CodeBuild before tests
 *
 * Prerequisites:
 * - CodeBuild role has S3 read permissions
 *
 * Usage: npx ts-node scripts/downloadSessionFromS3.ts
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const SESSION_DIR = path.resolve(__dirname, '../auth');
const SESSION_FILE = path.resolve(SESSION_DIR, 'googleSession.json');
const S3_BUCKET = process.env.S3_BUCKET || 'dopamint-test-assets';
const S3_KEY = process.env.S3_SESSION_KEY || 'playwright/googleSession.json';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';

async function downloadSession() {
    console.log('\n========================================');
    console.log('📥 DOWNLOAD SESSION FROM S3');
    console.log('========================================\n');

    // Ensure auth directory exists
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
        console.log(`📁 Created directory: ${SESSION_DIR}`);
    }

    console.log(`🌍 Region: ${AWS_REGION}`);
    console.log(`🪣 Bucket: ${S3_BUCKET}`);
    console.log(`🔑 Key: ${S3_KEY}`);
    console.log(`📁 Saving to: ${SESSION_FILE}`);

    // Create S3 client
    const s3Client = new S3Client({ region: AWS_REGION });

    console.log(`\n🚀 Downloading from s3://${S3_BUCKET}/${S3_KEY}...`);

    try {
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY,
        }));

        // Convert stream to string
        const bodyContents = await response.Body?.transformToString();
        if (!bodyContents) {
            throw new Error('Empty response from S3');
        }

        // Write to file
        fs.writeFileSync(SESSION_FILE, bodyContents);

        // Verify download
        const stats = fs.statSync(SESSION_FILE);
        console.log(`\n✅ Download successful!`);
        console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

        // Validate JSON
        try {
            const content = JSON.parse(bodyContents);
            const cookieCount = content.cookies?.length || 0;
            console.log(`🍪 Cookies: ${cookieCount}`);
        } catch {
            console.warn('⚠️ Could not parse session file');
        }
    } catch (error: any) {
        console.error('❌ Download failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. Session was uploaded: npx ts-node scripts/uploadSessionToS3.ts');
        console.log('2. S3 bucket exists: ' + S3_BUCKET);
        console.log('3. AWS credentials/role has s3:GetObject permission');
        process.exit(1);
    }
}

downloadSession();
