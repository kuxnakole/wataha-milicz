import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization,content-type" };

webPush.setVapidDetails(
  "mailto:kontakt@watahamilicz.pl",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { title, body } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs } = await sb.from("push_subscriptions").select("*");
    const payload = JSON.stringify({ title, body, url: "https://watahamilicz.pl" });
    const results = await Promise.allSettled(
      (subs || []).map(s => webPush.sendNotification({ endpoint:s.endpoint, keys:{ p256dh:s.p256dh, auth:s.auth } }, payload))
    );
    const sent = results.filter(r => r.status === "fulfilled").length;
    // Usuń wygasłe subskrypcje
    const expired = results.map((r,i) => r.status==="rejected" && String((r as any).reason).includes("410") ? subs![i]?.endpoint : null).filter(Boolean);
    if (expired.length) await sb.from("push_subscriptions").delete().in("endpoint", expired);
    return new Response(JSON.stringify({ sent, total: subs?.length||0 }), { headers: {...cors,"Content-Type":"application/json"} });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: cors });
  }
});
