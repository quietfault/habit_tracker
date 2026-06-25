import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Вставь сюда два значения из Supabase:
//   Project Settings → API  (или диалог "Connect")
//   • Project URL          → SUPABASE_URL
//   • Publishable key       → SUPABASE_PUBLISHABLE_KEY  (sb_publishable_...)
//
// Оба значения ПУБЛИЧНЫЕ. Их безопасно коммитить в открытый репозиторий:
// доступ к данным защищён политиками RLS в базе, а не секретностью ключа.
// НИКОГДА не вставляй сюда secret-ключ (sb_secret_...).
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://qhnigvoxicyfjbpywuqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_W_dr1JWojVRQD2E-Jvy6mA_gKQWqWHw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
