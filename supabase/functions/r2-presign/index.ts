import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      return new Response(JSON.stringify({ success: false, error: 'R2 credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { key, contentType } = await req.json();
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'key is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
    const r2Url = `https://${accountId}.r2.cloudflarestorage.com/${BUCKET}/${key}`;

    // Create a signed PUT request (valid for 1 hour)
    const signed = await client.sign(new Request(r2Url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
      },
    }), { aws: { signQuery: true, allHeaders: true } });

    const presignedUrl = signed.url;
    console.log('Generated presigned URL for key:', key);

    return new Response(JSON.stringify({ success: true, url: presignedUrl, key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Presign error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Presign failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
