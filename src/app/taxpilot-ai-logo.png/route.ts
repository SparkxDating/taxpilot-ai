import { TAXPILOT_LOGO_PNG_BASE64 } from "@/lib/taxpilot-logo";

export function GET() {
  return new Response(Buffer.from(TAXPILOT_LOGO_PNG_BASE64, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
