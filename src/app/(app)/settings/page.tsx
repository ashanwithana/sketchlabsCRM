import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { SettingsForm, type SettingsDefaults } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const s = await getCompanySettings();

  const defaults: SettingsDefaults = {
    companyName: s.companyName,
    tagline: s.tagline ?? "",
    addressLine: s.addressLine ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    website: s.website ?? "",
    registrationNumber: s.registrationNumber ?? "",
    vatNumber: s.vatNumber ?? "",
    bankName: s.bankName ?? "",
    bankAccountName: s.bankAccountName ?? "",
    bankAccountNumber: s.bankAccountNumber ?? "",
    bankBranch: s.bankBranch ?? "",
    currency: s.currency,
    defaultTaxRate: (s.defaultTaxRateBp / 100).toString(),
    defaultValidDays: s.defaultValidDays,
    quotationTerms: s.quotationTerms,
    crTerms: s.crTerms,
    maintenanceTerms: s.maintenanceTerms,
    emailQuotationSubject: s.emailQuotationSubject,
    emailQuotationBody: s.emailQuotationBody,
    emailCrSubject: s.emailCrSubject,
    emailCrBody: s.emailCrBody,
    emailMaintenanceSubject: s.emailMaintenanceSubject,
    emailMaintenanceBody: s.emailMaintenanceBody,
    hasLogo: Boolean(s.logoPath),
    hasSignature: Boolean(s.signaturePath),
    version: s.updatedAt.getTime(),
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="These details appear on every quotation, CR, and maintenance PDF."
      />
      <SettingsForm defaults={defaults} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Backup and recovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted">
            A backup contains the full database and every stored file (logos, signatures, and emails). It can be made while the app is running.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <a href="/api/backup" className={buttonVariants({ variant: "primary" })}>
                <Download /> Download backup now
              </a>
            ) : (
              <span className="text-muted">Only administrators can create backups.</span>
            )}
          </div>
          <div className="rounded-lg bg-surface-muted p-4">
            <p className="font-medium text-foreground">To restore</p>
            <p className="mt-1 text-muted">
              Stop the app, then run <code className="num rounded bg-surface px-1.5 py-0.5 text-xs">npm run restore -- backups/&lt;file&gt;.tar.gz</code>. The current data is saved to <code className="num text-xs">backups/</code> first.
            </p>
          </div>
          <p className="text-xs text-muted">Scheduled backups: run <code className="num text-xs">npm run backup</code> from cron or Task Scheduler. Keep copies off the machine.</p>
        </CardContent>
      </Card>
    </>
  );
}
