import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';

// Manually parse .env.local
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  // Strip surrounding quotes if present
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_STORAGE_BUCKET,
} = process.env;

console.log('Project ID:', FIREBASE_PROJECT_ID);
console.log('Bucket:', FIREBASE_STORAGE_BUCKET);
console.log('Client Email:', FIREBASE_CLIENT_EMAIL);
console.log('Private Key loaded:', FIREBASE_PRIVATE_KEY ? 'YES' : 'NO');

// Init Firebase Admin
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  storageBucket: FIREBASE_STORAGE_BUCKET,
});

const bucket = getStorage().bucket();

// Create a tiny dummy PDF (just enough bytes to be a valid upload)
const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n9\n%%EOF');
const testPath = `library/test-upload-${Date.now()}.pdf`;

console.log('\nUploading test PDF to:', testPath);

try {
  const file = bucket.file(testPath);
  await file.save(dummyPdfContent, {
    contentType: 'application/pdf',
    metadata: { description: 'Test upload from CLI' },
  });

  // Get a signed URL valid for 1 hour
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  console.log('\n✅ Upload SUCCESS!');
  console.log('Signed URL (valid 1 hour):', url);

  // Clean up - delete the test file
  await file.delete();
  console.log('✅ Test file deleted (cleanup done)');
} catch (err) {
  console.error('\n❌ Upload FAILED:', err.message);
  if (err.code) console.error('Error code:', err.code);
}
