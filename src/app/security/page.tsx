import { SiteHeader } from "@/components/site-header";
import { Card, Disclaimer } from "@/components/ui";

export default function Security() {
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl">Security</h1>
        <div className="mt-8 space-y-3">
          {[
            "Passwords are hashed. Sessions are httpOnly, 12-hour JWTs.",
            "Documents are stored privately with signed URLs. They are not written to application logs.",
            "PAN and Aadhaar are excluded from analytics metadata.",
            "Income Tax portal credentials are never collected.",
            "Role-based access: USER, TAX_PROFESSIONAL, ADMIN.",
            "2FA fields exist on the user record for a later TOTP rollout.",
            "Document deletion controls are available via storage.delete.",
          ].map((t) => (
            <Card key={t}>{t}</Card>
          ))}
        </div>
        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
