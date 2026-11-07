/**
 * Server-side environment access. Never import this from client components.
 * Secrets are read lazily so builds succeed without them.
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get appUrl() {
    return read("APP_URL") ?? "http://localhost:3000";
  },
  get authSecret() {
    const s = read("AUTH_SECRET");
    if (!s && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production");
    }
    return s ?? "dev-only-insecure-secret-change-me";
  },
  get xaiApiKey() {
    return read("XAI_API_KEY");
  },
  get xaiModel() {
    return read("XAI_MODEL") ?? "grok-4.7";
  },
  get xaiVisionModel() {
    return read("XAI_VISION_MODEL") ?? read("XAI_MODEL") ?? "grok-4.7";
  },
  get aiHourlyLimit() {
    return Number(read("AI_HOURLY_LIMIT") ?? 30);
  },
  get weatherProvider() {
    return read("WEATHER_PROVIDER") ?? "open-meteo";
  },
  get weatherApiKey() {
    return read("WEATHER_API_KEY");
  },
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get supabaseBucket() {
    return read("SUPABASE_STORAGE_BUCKET") ?? "agriflow-uploads";
  },
  get resendApiKey() {
    return read("RESEND_API_KEY");
  },
  get emailFrom() {
    return read("EMAIL_FROM") ?? "AgriFlow AI <no-reply@example.com>";
  },
  get demoMode() {
    return (read("DEMO_MODE") ?? "true") === "true";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export const isAIConfigured = () => Boolean(env.xaiApiKey);
