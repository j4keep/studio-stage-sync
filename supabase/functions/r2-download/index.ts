import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BUCKET = 'wheuat-media';

function getClient() {
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  if (!accessKeyId || !secretAccessKey || !accountId) throw new Error('R2 credentials not configured');
  const r2Url = `https://${accountId}.r2.cloudflarestorage.com`;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  return { client, r2Url };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, r2Url } = getClient();

    const urlObj = new URL(req.url);
    let key = urlObj.searchParams.get('key');
    if (!key && req.method === 'POST') {
      const body = await req.json();
      key = body.key;
    }
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'key parameter is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requestUrl = `${r2Url}/${BUCKET}/${key}`;
    const r2Response = await client.fetch(requestUrl, { method: 'GET' });

    if (!r2Response.ok) {
      const errorText = await r2Response.text();
      console.error('R2 download error:', r2Response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: `Download failed: ${r2Response.status}` }), { status: r2Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ct = r2Response.headers.get('content-type') || 'application/octet-stream';
    const fileData = await r2Response.arrayBuffer();
    console.log('Download successful:', key, `(${fileData.byteLength} bytes)`);

    return new Response(fileData, {
      headers: { ...corsHeaders, 'Content-Type': ct, 'Content-Length': fileData.byteLength.toString(), 'Content-Disposition': `inline; filename="${key.split('/').pop()}"`, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('Download error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Download failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
