import { ImageResponse } from "next/og";

/** PNG app icons generated from the AgriFlow mark (192, 512, maskable). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const maskable = raw === "maskable";
  const size = maskable ? 512 : raw === "192" ? 192 : 512;
  const pad = maskable ? size * 0.18 : 0;
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#14532D", borderRadius: maskable ? 0 : size * 0.22 }}>
        <svg width={inner} height={inner} viewBox="8 8 24 24">
          <path d="M11 29.5C11 18 18.5 10.5 30 10c.4 11.6-7.2 19.4-19 19.5Z" fill="#16A34A" />
          <path d="M12.5 28.5c3.4-2 5.2-4.7 7.4-8.1 1.7-2.7 3.7-5.2 7.6-7.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="27.5" cy="13" r="2.1" fill="#fff" />
          <circle cx="19.9" cy="20.4" r="1.6" fill="#DCFCE7" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
