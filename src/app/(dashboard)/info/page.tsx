import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InfoForm } from "@/components/info/info-form"
import { InfoCard } from "@/components/info/info-card"
import { StyretCard } from "@/components/info/styret-card"
import { BeboereCard } from "@/components/info/beboere-card"
import { BookOpen } from "lucide-react"
import type { BoardMember, ProfileSummary } from "@/types"

const CATEGORIES = ["Tjenester", "Kontakter", "Nødhjelp", "Annet"]

export default async function InfoPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect("/login")

  const [{ data: entries }, { data: profile }, { data: boardMembers }, { data: residents }] = await Promise.all([
    supabase.from("info_entries").select("*, creator:profiles!info_entries_created_by_fkey(id, full_name, email)").order("category").order("created_at", { ascending: false }),
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
    supabase.from("board_members").select("id, user_id, role, created_at, profile:profiles(id, full_name, email, phone_number, unit_number)").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email, phone_number, unit_number, avatar_url").eq("is_approved", true).order("full_name"),
  ])

  const grouped: Record<string, typeof entries> = {}
  for (const cat of CATEGORIES) {
    const items = (entries ?? []).filter((e) => e.category === cat)
    if (items.length > 0) grouped[cat] = items
  }
  const otherEntries = (entries ?? []).filter((e) => !CATEGORIES.includes(e.category))
  if (otherEntries.length > 0) grouped["Annet"] = [...(grouped["Annet"] ?? []), ...otherEntries]

  const totalCount = entries?.length ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Nyttig info
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount === 0
              ? "Ingen oppføringer ennå"
              : `${totalCount} oppføring${totalCount !== 1 ? "er" : ""}`}
          </p>
        </div>
        <InfoForm />
      </div>

      <div className="mb-8">
        <StyretCard
          boardMembers={(boardMembers ?? []) as unknown as BoardMember[]}
          residents={(residents ?? []) as ProfileSummary[]}
          isAdmin={!!profile?.is_admin}
        />
      </div>

      <div className="mb-8">
        <BeboereCard residents={residents ?? []} />
      </div>

      {totalCount > 0 ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {category}
              </h2>
              <div className="space-y-3">
                {items!.map((entry) => (
                  <InfoCard
                    key={entry.id}
                    entry={entry}
                    currentUserId={user.id}
                    isAdmin={!!profile?.is_admin}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">Ingen oppføringer ennå</p>
          <p className="text-sm text-muted-foreground mt-1">
            Legg til nyttige telefonnumre og kontakter for nabolaget.
          </p>
        </div>
      )}
    </div>
  )
}
