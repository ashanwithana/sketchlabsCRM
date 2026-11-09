/* D1 init migration – replace with full schema */
-- Replace the generated migration with the D1 schema we use.
-- The content below is copied from prisma/d1-init.sql

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'company',
    "companyName" TEXT NOT NULL DEFAULT 'Your Company Name',
    "tagline" TEXT,
    "addressLine" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranch" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultTaxRateBp" INTEGER NOT NULL DEFAULT 0,
    "defaultValidDays" INTEGER NOT NULL DEFAULT 30,
    "logoPath" TEXT,
    "signaturePath" TEXT,
    "quotationTerms" TEXT NOT NULL DEFAULT 'Prices are valid until the expiry date shown. Payment terms: 50% advance, balance on completion.',
    "crTerms" TEXT NOT NULL DEFAULT 'The customer confirms the scope of work above and authorises the company to proceed.',
    "maintenanceTerms" TEXT NOT NULL DEFAULT 'Service reports are issued for the equipment listed. Recommendations are advisory.',
    "emailQuotationSubject" TEXT NOT NULL DEFAULT 'Quotation {{number}} from {{company}}',
    "emailQuotationBody" TEXT NOT NULL DEFAULT 'Dear {{contact}},\n\nPlease find attached quotation {{number}}, valid until {{date}}.\n\nKind regards,\n{{company}}',
    "emailCrSubject" TEXT NOT NULL DEFAULT 'CR {{number}} from {{company}}',
    "emailCrBody" TEXT NOT NULL DEFAULT 'Dear {{contact}},\n\nPlease find attached customer request document {{number}}.\n\nKind regards,\n{{company}}',
    "emailMaintenanceSubject" TEXT NOT NULL DEFAULT 'Maintenance report {{number}} from {{company}}',
    "emailMaintenanceBody" TEXT NOT NULL DEFAULT 'Dear {{contact}},\n\nPlease find attached the maintenance report {{number}}.\n\nKind regards,\n{{company}}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Sequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "billingAddress" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "vatNumber" TEXT,
    "category" TEXT NOT NULL,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "billingCycle" TEXT,
    "billingDay" INTEGER,
    "billingActive" BOOLEAN NOT NULL DEFAULT false,
    "billingAnchor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClientService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "taxRateBp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientService_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "installedOn" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "terms" TEXT,
    "notes" TEXT,
    "approvedAt" DATETIME,
    "approvalToken" TEXT,
    "approvalTokenExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "crId" TEXT,
    CONSTRAINT "Quotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quotation_crId_fkey" FOREIGN KEY ("crId") REFERENCES "CRDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuotationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "taxRateBp" INTEGER NOT NULL DEFAULT 0,
    "lineSubtotal" INTEGER NOT NULL DEFAULT 0,
    "lineTax" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CRDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "requestDetails" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "deliveryDate" DATETIME,
    "customerRequirements" TEXT,
    "remarks" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CRDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingDay" INTEGER NOT NULL DEFAULT 1,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "terms" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenanceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "taxRateBp" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MaintenanceLine_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MaintenanceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "periodStart" DATETIME,
    "dueDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "taxRateBp" INTEGER NOT NULL DEFAULT 0,
    "lineTax" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT,
    "revisionId" TEXT,
    "clientId" TEXT,
    "toAddress" TEXT NOT NULL,
    "ccAddress" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment" TEXT,
    "outboxPath" TEXT,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DocumentRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Client_clientCode_key" ON "Client"("clientCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientService_clientId_idx" ON "ClientService"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Equipment_clientId_idx" ON "Equipment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Document_number_key" ON "Document"("number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_issueDate_idx" ON "Document"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_documentId_key" ON "Quotation"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_approvalToken_key" ON "Quotation"("approvalToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quotation_crId_idx" ON "Quotation"("crId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CRDocument_documentId_key" ON "CRDocument"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CRDocument_documentId_idx" ON "CRDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceRecord_documentId_key" ON "MaintenanceRecord"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_cycle_idx" ON "MaintenanceRecord"("cycle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceLine_recordId_idx" ON "MaintenanceLine"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_documentId_key" ON "Invoice"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_periodStart_idx" ON "Invoice"("periodStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentRevision_documentId_revision_key" ON "DocumentRevision"("documentId", "revision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailLog_documentId_idx" ON "EmailLog"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailLog_clientId_idx" ON "EmailLog"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
