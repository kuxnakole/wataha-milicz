import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OS_APP_ID  = "2c454274-778b-4e89-b07c-337f5ab1e05b";
const OS_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, body, url } = await req.json();

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${OS_API_KEY}`,
      },
      body: JSON.stringify({
        app_id:              OS_APP_ID,
        included_segments:   ["All"],
        headings:            { en: title, pl: title },
        contents:            { en: body,  pl: body  },
        url:                 url || "https://watahamilicz.pl",
        chrome_web_icon:     "https://watahamilicz.pl/icon-192.png",
        firefox_icon:        "https://watahamilicz.pl/icon-192.png",
        chrome_web_badge:    "https://watahamilicz.pl/icon-192.png",
      }),
    });

    const data = await res.json();
    console.log("OneSignal response:", JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: !data.errors, recipients: data.recipients || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
