export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EventForm } from "@/components/calendar/event-form"
import { CalendarView } from "@/components/calendar/calendar-view"
import { CalendarDays } from "lucide-react"
import type { ProfileSummary, MaintenanceAssignment } from "@/types"

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect("/login")

  const [eventsRes, profilesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("events")
      .select(`
        *,
        creator:profiles!events_created_by_fkey(id, full_name, email, unit_number),
        invitations:event_invitations(id, user_id, status, profile:profiles(id, full_name, email, unit_number))
      `)
      .order("start_time", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email, unit_number").order("full_name"),
    supabase
      .from("maintenance_assignments")
      .select(`*, profile:profiles(id, full_name, email, unit_number), plan:maintenance_plans(id, title, recurrence)`)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("scheduled_date", { ascending: true })
      .limit(50),
  ])

  const events = eventsRes.data ?? []
  const members = (profilesRes.data ?? []) as ProfileSummary[]
  const assignments = (assignmentsRes.data ?? []) as MaintenanceAssignment[]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Kalender
          </h1>
        </div>
        <EventForm members={members} currentUserId={user.id} />
      </div>

      <CalendarView events={events} assignments={assignments} members={members} currentUserId={user.id} />
    </div>
  )
}
