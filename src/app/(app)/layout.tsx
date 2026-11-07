import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

// Server-side session check for every page in the app group. The proxy redirects
// first for speed; this check is the authoritative one.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Every page here depends on the request's cookies, so render at request time.
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell userName={user.name} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
