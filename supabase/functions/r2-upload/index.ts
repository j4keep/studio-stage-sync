import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-upload-key, x-upload-content-type',
};

const BUCKET = 'wheuat-media';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')?.trim();
    const accountId = Deno.env.get('R2_ACCOUNT_ID')?.trim();

    if (!accessKeyId || !secretAccessKey || !accountId) {
      return new Response(JSON.stringify({ success: false, error: 'R2 credentials not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
    const r2Url = `https://${accountId}.r2.cloudflarestorage.com`;

    // Check for streaming upload via custom headers (large files)
    const uploadKey = req.headers.get('x-upload-key');
    if (uploadKey) {
      const mimeType = req.headers.get('x-upload-content-type') || 'application/octet-stream';
      const key = uploadKey;
      const url = `${r2Url}/${BUCKET}/${key}`;
      console.log('Streaming upload to:', url);

      // Buffer the body so we can send Content-Length to R2
      const bodyBuffer = await req.arrayBuffer();
      const r2Response = await client.fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType, 'Content-Length': bodyBuffer.byteLength.toString() },
        body: bodyBuffer,
      });

      if (!r2Response.ok) {
        const errorText = await r2Response.text();
        console.error('R2 streaming upload error:', r2Response.status, errorText);
        return new Response(JSON.stringify({ success: false, error: `R2 upload failed: ${r2Response.status}` }), { status: r2Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await r2Response.text();

      const contentLength = req.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength) : 0;
      console.log('Streaming upload successful:', key, size, 'bytes');
      return new Response(JSON.stringify({ success: true, key, url, size }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fallback: multipart/form-data upload (small files < 5MB)
    const contentType = req.headers.get('content-type') || '';
    let fileData: ArrayBuffer;
    let fileName: string;
    let mimeType: string;
    let folder: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(JSON.stringify({ success: false, error: 'No file provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      fileData = await file.arrayBuffer();
      fileName = formData.get('fileName')?.toString() || file.name;
      mimeType = formData.get('mimeType')?.toString() || file.type || 'application/octet-stream';
      folder = formData.get('folder')?.toString() || '';
    } else {
      const body = await req.json();
      if (!body.fileBase64 || !body.fileName) {
        return new Response(JSON.stringify({ success: false, error: 'fileBase64 and fileName are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const bin = atob(body.fileBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      fileData = bytes.buffer;
      fileName = body.fileName;
      mimeType = body.mimeType || 'application/octet-stream';
      folder = body.folder || '';
    }

    const key = folder ? `${folder}/${fileName}` : fileName;
    const url = `${r2Url}/${BUCKET}/${key}`;
    console.log('Uploading to:', url);

    const r2Response = await client.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: fileData,
    });

    if (!r2Response.ok) {
      const errorText = await r2Response.text();
      console.error('R2 upload error:', r2Response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: `R2 upload failed: ${r2Response.status}` }), { status: r2Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await r2Response.text();

    console.log('Upload successful:', key);
    return new Response(JSON.stringify({ success: true, key, url, size: fileData.byteLength }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Upload failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
