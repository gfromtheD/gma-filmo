/**
 * seed-creators.mjs
 *
 * Carga masiva de creadores en la tabla `artistas` a partir de creators-data.json.
 * Script plano de Node (no hay ts-node/tsx en este repo), carga .env.local a mano.
 *
 * Uso: node seed-creators.mjs
 * Requiere: .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const path = "./.env.local";
  const env  = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const creators = JSON.parse(readFileSync("./creators-data.json", "utf-8"));

  for (const creator of creators) {
    const { error } = await supabase
      .from("artistas")
      .upsert(
        {
          name:         creator.name,
          slug:         creator.slug,
          bio:          creator.bio ?? null,
          r2_photo_url: creator.r2_photo_url ?? null,
        },
        { onConflict: "slug" },
      );

    if (error) {
      console.error(`❌ Error en ${creator.name}:`, error.message);
    } else {
      console.log(`✓ ${creator.name}`);
    }
  }
}

main();
