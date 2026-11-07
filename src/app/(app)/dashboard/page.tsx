import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, FileText, Plus, Users, Wrench, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CountUp } from "@/components/dashboard/count-up";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData();
  const firstName = user.name.split(" ")[0];

  const stats = [
    { label: "Registered clients", value: data.totalClients, icon: Users, href: "/clients", tone: "primary" },
    { label: "Quotations", value: data.totalQuotations, icon: FileText, href: "/quotations", tone: "primary" },
    { label: "Pending quotations", value: data.pendingQuotations, icon: Clock, href: "/quotations?status=PENDING", tone: "warning" },
    { label: "Approved quotations", value: data.approvedQuotations, icon: CheckCircle2, href: "/quotations?status=APPROVED", tone: "success" },
    { label: "CR documents", value: data.totalCrs, icon: ClipboardCheck, href: "/cr", tone: "primary" },
    { label: "Active agreements", value: data.upcomingMaintenance.length, icon: CalendarClock, href: "/maintenance", tone: "info" },
  ] as const;

  const toneClasses: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
  };

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here is where your clients and documents stand today."
        actions={
          <>
            <Link href="/clients/new" className={buttonVariants({ variant: "primary" })}>
              <Plus /> Register client
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="animate-fade-up group rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className={cn("flex size-10 items-center justify-center rounded-xl", toneClasses[s.tone])}>
                  <Icon className="size-5" />
                </span>
                <ArrowRight className="size-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                <CountUp value={s.value} />
              </p>
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active agreements</CardTitle>
            <Link href="/maintenance" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          {data.upcomingMaintenance.length === 0 ? (
            <EmptyState
              icon={<Wrench />}
              title="No active agreements"
              description="Create a maintenance agreement to set up recurring billing."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.upcomingMaintenance.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.companyName}</p>
                    <p className="truncate text-xs text-muted">
                      {m.equipment} · <span className="num">{m.number}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    {m.overdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                        <AlertTriangle className="size-3" /> Overdue
                      </span>
                    )}
                    <span className="num text-sm text-muted">{m.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <div className="grid gap-2 p-3">
            <QuickAction href="/clients/new" label="Register a client" description="Add a company and its contact" />
            <QuickAction href="/quotations/new" label="New quotation" description="Coming in Task 5" disabled />
            <QuickAction href="/cr/new" label="New CR document" description="Coming in Task 8" disabled />
            <QuickAction href="/maintenance/new" label="New maintenance agreement" description="Set up recurring billing" />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon={<Users />} title="No activity yet" description="Changes you make will appear here." />
          ) : (
            <ol className="divide-y divide-border">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <p className="min-w-0 flex-1 text-sm text-foreground">{a.summary}</p>
                  <time className="num shrink-0 text-xs text-muted" dateTime={a.createdAt.toISOString()}>
                    {a.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

function QuickAction({ href, label, description, disabled }: { href: string; label: string; description: string; disabled?: boolean }) {
  const content = (
    <>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      {!disabled && <ArrowRight className="size-4 text-subtle" />}
    </>
  );
  if (disabled) {
    return (
      <span aria-disabled="true" className="flex items-center justify-between rounded-lg border border-dashed border-border-strong px-4 py-3 opacity-60">
        {content}
      </span>
    );
  }
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary hover:bg-primary-soft/50">
      {content}
    </Link>
  );
}
