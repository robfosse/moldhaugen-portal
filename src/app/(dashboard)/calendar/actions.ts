"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { sendEmail, eventEmail } from "@/lib/email"
import { sendPushToUsers } from "@/lib/push"

async function broadcastCalendarUpdate() {
  try {
    const supabase = createServiceClient()
    await supabase.channel("calendar").send({ type: "broadcast", event: "refresh", payload: {} })
  } catch { /* non-critical */ }
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const location = formData.get("location") as string
  const start_time = formData.get("start_time") as string
  const end_time = formData.get("end_time") as string
  const is_public = formData.get("is_public") === "true"
  const invited = formData.getAll("invited") as string[]

  const { data: event, error } = await supabase
    .from("events")
    .insert({ title, description: description || null, location: location || null, start_time, end_time, is_public, created_by: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  // fetch creator name once for emails
  const { data: creator } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single()

  const emailHtml = eventEmail({
    eventTitle: title,
    startTime: start_time,
    endTime: end_time,
    location: location || null,
    description: description || null,
    isPublic: is_public,
    creatorName: creator?.full_name ?? "En beboer",
    portalUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  })

  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""

  if (!is_public && invited.length > 0) {
    await supabase.from("event_invitations").insert(
      invited.map((uid) => ({ event_id: event.id, user_id: uid }))
    )
    const { data: inviteeProfiles } = await supabase
      .from("profiles")
      .select("id, email, email_event_notifications, push_notifications_enabled")
      .in("id", invited)
    const invitees = (inviteeProfiles ?? []).filter((p) => p.email !== creator?.email)
    const inviteeEmails = invitees.filter((p) => p.email_event_notifications).map((p) => p.email).filter(Boolean) as string[]
    if (inviteeEmails.length > 0) sendEmail(inviteeEmails, `Invitasjon: ${title}`, emailHtml)
    const pushIds = invitees.filter((p) => p.push_notifications_enabled).map((p) => p.id)
    if (pushIds.length > 0) sendPushToUsers(pushIds, `Invitasjon: ${title}`, `${creator?.full_name ?? "En beboer"} har invitert deg`, `${portalUrl}/calendar`)
  } else if (is_public) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, email, email_event_notifications, push_notifications_enabled")
      .eq("is_approved", true)
    const others = (allProfiles ?? []).filter((p) => p.email !== creator?.email)
    const publicEmails = others.filter((p) => p.email_event_notifications).map((p) => p.email).filter(Boolean) as string[]
    if (publicEmails.length > 0) sendEmail(publicEmails, `Ny hendelse: ${title}`, emailHtml)
    const pushIds = others.filter((p) => p.push_notifications_enabled).map((p) => p.id)
    if (pushIds.length > 0) sendPushToUsers(pushIds, `Ny hendelse: ${title}`, `${creator?.full_name ?? "En beboer"} har lagt til en hendelse`, `${portalUrl}/calendar`)
  }

  revalidatePath("/calendar")
  await broadcastCalendarUpdate()
  return { success: true }
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const location = formData.get("location") as string
  const start_time = formData.get("start_time") as string
  const end_time = formData.get("end_time") as string
  const is_public = formData.get("is_public") === "true"
  const invited = formData.getAll("invited") as string[]

  if (!title?.trim()) return { error: "Tittel mangler" }
  if (new Date(end_time) < new Date(start_time)) return { error: "Slutt kan ikke være før start" }

  const { data: updated, error } = await supabase
    .from("events")
    .update({
      title,
      description: description || null,
      location: location || null,
      start_time,
      end_time,
      is_public,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id")

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: "Kunne ikke lagre – du kan bare redigere egne hendelser" }

  // Sync invitations for private events (public events keep any existing invitations, e.g. tool loans)
  if (!is_public) {
    const { data: existing } = await supabase
      .from("event_invitations")
      .select("user_id")
      .eq("event_id", id)
    const existingIds = (existing ?? []).map((i) => i.user_id as string)
    const toRemove = existingIds.filter((uid) => !invited.includes(uid))
    const toAdd = invited.filter((uid) => !existingIds.includes(uid))
    if (toRemove.length > 0) {
      await supabase.from("event_invitations").delete().eq("event_id", id).in("user_id", toRemove)
    }
    if (toAdd.length > 0) {
      await supabase.from("event_invitations").insert(toAdd.map((uid) => ({ event_id: id, user_id: uid })))
    }
  }

  revalidatePath("/calendar")
  await broadcastCalendarUpdate()
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id)

  if (error) return { error: error.message }
  revalidatePath("/calendar")
  await broadcastCalendarUpdate()
  return { success: true }
}
