import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, Wrench, Home, LogOut, ShieldCheck, BookOpen, Pin, Hammer } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { logout } from "@/app/(auth)/actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { MobileProfileMenu } from "@/components/layout/mobile-profile-menu"
import { InstallPrompt } from "@/components/layout/install-prompt"
import { ThemeToggle } from "@/components/theme-toggle"
import { PushInit } from "@/components/push/push-init"

const navItems = [
  { href: "/oppslagstavle", label: "Oppslag", icon: Pin },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/maintenance", label: "Vedlikehold", icon: Wrench },
  { href: "/verktoy", label: "Verktøy", icon: Hammer },
  { href: "/info", label: "Nyttig info", icon: BookOpen },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, is_approved, is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_approved) redirect("/pending")

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? "Bruker"
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const sidebarNavItems = [
    ...navItems,
    ...(profile?.is_admin ? [{ href: "/admin", label: "Administrasjon", icon: ShieldCheck }] : []),
  ]

  return (
    <div className="flex h-full min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col"
        style={{ background: "var(--sidebar-bg)", color: "var(--sidebar-fg)" }}
      >
        <Link href="/oppslagstavle" className="flex items-center gap-3 px-6 py-5 hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight" style={{ color: "var(--sidebar-fg)" }}>
              Moldhaugen
            </p>
            <p className="text-xs" style={{ color: "var(--sidebar-muted-fg)" }}>
              Nabolagsportalen
            </p>
          </div>
        </Link>

        <Separator style={{ background: "var(--sidebar-border)" }} />

        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarNavItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: "var(--sidebar-fg)" }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <Separator style={{ background: "var(--sidebar-border)" }} />

        <div className="flex items-center gap-3 px-4 py-4">
          <Link href="/profile" className="shrink-0">
            <Avatar className="h-9 w-9 hover:ring-2 hover:ring-primary transition-all">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
              <AvatarFallback className="bg-primary text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <Link href="/profile" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-fg)" }}>
              {displayName}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--sidebar-muted-fg)" }}>
              {user.email}
            </p>
          </Link>
          <ThemeToggle
            className="rounded p-1 hover:bg-white/10 transition-colors"
            style={{ color: "var(--sidebar-muted-fg)" }}
          />
          <form action={logout}>
            <button
              type="submit"
              title="Logg ut"
              className="rounded p-1 hover:bg-white/10 transition-colors"
              style={{ color: "var(--sidebar-muted-fg)" }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <Link href="/oppslagstavle" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Moldhaugen</span>
        </Link>
        <MobileProfileMenu
          displayName={displayName}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
          isAdmin={!!profile?.is_admin}
        />
      </div>

      {/* Mobile bottom nav — core pages only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-border bg-card">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        ))}
      </nav>

      <main className="flex-1 overflow-auto bg-background md:pt-0 pt-14 pb-16 md:pb-0">
        <PushInit />
        <InstallPrompt />
        {children}
      </main>
    </div>
  )
}
