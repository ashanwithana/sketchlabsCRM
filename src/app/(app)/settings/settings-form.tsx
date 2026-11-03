"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { updateSettingsAction, type SettingsState } from "./actions";

export type SettingsDefaults = {
  companyName: string;
  tagline: string;
  addressLine: string;
  phone: string;
  email: string;
  website: string;
  registrationNumber: string;
  vatNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  currency: string;
  defaultTaxRate: string;
  defaultValidDays: number;
  quotationTerms: string;
  crTerms: string;
  maintenanceTerms: string;
  emailQuotationSubject: string;
  emailQuotationBody: string;
  emailCrSubject: string;
  emailCrBody: string;
  emailMaintenanceSubject: string;
  emailMaintenanceBody: string;
  hasLogo: boolean;
  hasSignature: boolean;
  version: number;
};

const initialState: SettingsState = { status: "idle" };

const CURRENCIES = ["USD", "EUR", "GBP", "LKR", "INR", "AUD", "CAD", "SGD", "AED"];

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    // Remounting on every saved version resets the inputs to the stored values.
    <form key={defaults.version} action={formAction} className="space-y-6" noValidate>
      {state.status === "saved" && (
        <div role="status" className="animate-fade-up flex items-center gap-2 rounded-lg border border-success-soft bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> {state.message}
        </div>
      )}
      {state.status === "error" && state.message && (
        <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Company name" htmlFor="companyName" required error={errors.companyName} className="md:col-span-2">
            <Input id="companyName" name="companyName" defaultValue={defaults.companyName} aria-invalid={Boolean(errors.companyName)} />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={errors.tagline}>
            <Input id="tagline" name="tagline" defaultValue={defaults.tagline} placeholder="Optional" />
          </Field>
          <Field label="Website" htmlFor="website" error={errors.website}>
            <Input id="website" name="website" defaultValue={defaults.website} placeholder="www.example.com" />
          </Field>
          <Field label="Address" htmlFor="addressLine" error={errors.addressLine} className="md:col-span-2">
            <Textarea id="addressLine" name="addressLine" defaultValue={defaults.addressLine} rows={2} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={defaults.email} />
          </Field>
          <Field label="Company registration number" htmlFor="registrationNumber" error={errors.registrationNumber}>
            <Input id="registrationNumber" name="registrationNumber" defaultValue={defaults.registrationNumber} />
          </Field>
          <Field label="VAT number" htmlFor="vatNumber" error={errors.vatNumber}>
            <Input id="vatNumber" name="vatNumber" defaultValue={defaults.vatNumber} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo and signature</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ImageUpload
            id="logo"
            label="Company logo"
            hint="Shown at the top of every PDF. PNG, JPEG, or WebP, up to 2 MB."
            hasImage={defaults.hasLogo}
            src={`/api/assets/logo?v=${defaults.version}`}
            error={errors.logo}
          />
          <ImageUpload
            id="signature"
            label="Prepared-by signature"
            hint="Used in the signature block on quotations and reports."
            hasImage={defaults.hasSignature}
            src={`/api/assets/signature?v=${defaults.version}`}
            error={errors.signature}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Bank name" htmlFor="bankName" error={errors.bankName}>
            <Input id="bankName" name="bankName" defaultValue={defaults.bankName} />
          </Field>
          <Field label="Account name" htmlFor="bankAccountName" error={errors.bankAccountName}>
            <Input id="bankAccountName" name="bankAccountName" defaultValue={defaults.bankAccountName} />
          </Field>
          <Field label="Account number" htmlFor="bankAccountNumber" error={errors.bankAccountNumber}>
            <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={defaults.bankAccountNumber} className="num" />
          </Field>
          <Field label="Branch" htmlFor="bankBranch" error={errors.bankBranch}>
            <Input id="bankBranch" name="bankBranch" defaultValue={defaults.bankBranch} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <Field label="Currency" htmlFor="currency" required error={errors.currency}>
            <Select id="currency" name="currency" defaultValue={defaults.currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {!CURRENCIES.includes(defaults.currency) && <option value={defaults.currency}>{defaults.currency}</option>}
            </Select>
          </Field>
          <Field label="Default tax rate (%)" htmlFor="defaultTaxRate" error={errors.defaultTaxRate} hint="Pre-fills new line items.">
            <Input id="defaultTaxRate" name="defaultTaxRate" inputMode="decimal" defaultValue={defaults.defaultTaxRate} className="num" />
          </Field>
          <Field label="Quotation validity (days)" htmlFor="defaultValidDays" required error={errors.defaultValidDays}>
            <Input id="defaultValidDays" name="defaultValidDays" type="number" min={1} max={365} defaultValue={defaults.defaultValidDays} className="num" />
          </Field>
          <Field label="Quotation terms" htmlFor="quotationTerms" required error={errors.quotationTerms} className="md:col-span-3">
            <Textarea id="quotationTerms" name="quotationTerms" defaultValue={defaults.quotationTerms} rows={4} />
          </Field>
          <Field label="CR terms" htmlFor="crTerms" required error={errors.crTerms} className="md:col-span-3">
            <Textarea id="crTerms" name="crTerms" defaultValue={defaults.crTerms} rows={3} />
          </Field>
          <Field label="Maintenance terms" htmlFor="maintenanceTerms" required error={errors.maintenanceTerms} className="md:col-span-3">
            <Textarea id="maintenanceTerms" name="maintenanceTerms" defaultValue={defaults.maintenanceTerms} rows={3} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email templates</CardTitle>
          <span className="text-xs text-muted">Placeholders: {"{{contact}} {{client}} {{number}} {{company}} {{date}} {{validUntil}} {{amount}}"}</span>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Quotation subject" htmlFor="emailQuotationSubject" required error={errors.emailQuotationSubject}>
            <Input id="emailQuotationSubject" name="emailQuotationSubject" defaultValue={defaults.emailQuotationSubject} />
          </Field>
          <Field label="Quotation message" htmlFor="emailQuotationBody" required error={errors.emailQuotationBody} className="md:row-span-2">
            <Textarea id="emailQuotationBody" name="emailQuotationBody" defaultValue={defaults.emailQuotationBody} rows={5} />
          </Field>
          <Field label="CR subject" htmlFor="emailCrSubject" required error={errors.emailCrSubject}>
            <Input id="emailCrSubject" name="emailCrSubject" defaultValue={defaults.emailCrSubject} />
          </Field>
          <Field label="CR message" htmlFor="emailCrBody" required error={errors.emailCrBody}>
            <Textarea id="emailCrBody" name="emailCrBody" defaultValue={defaults.emailCrBody} rows={3} />
          </Field>
          <Field label="Maintenance subject" htmlFor="emailMaintenanceSubject" required error={errors.emailMaintenanceSubject}>
            <Input id="emailMaintenanceSubject" name="emailMaintenanceSubject" defaultValue={defaults.emailMaintenanceSubject} />
          </Field>
          <Field label="Maintenance message" htmlFor="emailMaintenanceBody" required error={errors.emailMaintenanceBody}>
            <Textarea id="emailMaintenanceBody" name="emailMaintenanceBody" defaultValue={defaults.emailMaintenanceBody} rows={3} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function ImageUpload({
  id,
  label,
  hint,
  hasImage,
  src,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  hasImage: boolean;
  src: string;
  error?: string;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (hasImage ? src : null);

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <label
        htmlFor={id}
        className="group flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-surface-muted p-4 text-center transition-colors hover:border-primary hover:bg-primary-soft"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={`${label} preview`} className="max-h-24 max-w-full object-contain" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-subtle">
            <ImageIcon className="size-5" />
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <Upload className="size-3.5" /> {shown ? "Replace image" : "Choose image"}
        </span>
        <input
          id={id}
          name={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </label>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
