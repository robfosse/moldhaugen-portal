"use client"

import { useState } from "react"
import { deleteEvent } from "@/app/(dashboard)/calendar/actions"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, MapPin, Pencil, Trash2, Users, Lock } from "lucide-react"
import { EventForm } from "./event-form"
import type { Event, ProfileSummary } from "@/types"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

type Props = { event: Event; currentUserId: string; members: ProfileSummary[] }

export function EventCard({ event, currentUserId, members }: Props) {
  const [loading, setLoading] = useState(false)
  const isOwner = event.created_by === currentUserId

  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const sameDay = start.toDateString() === end.toDateString()
  const isAllDay = start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && end.getUTCHours() === 0 && end.getUTCMinutes() === 0

  async function handleDelete() {
    if (!confirm(`Slett "${event.title}"?`)) return
    setLoading(true)
    await deleteEvent(event.id)
    setLoading(false)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm">{event.title}</h3>
              <Badge variant={event.is_public ? "secondary" : "outline"} className="text-xs flex items-center gap-1">
                {event.is_public ? (
                  <><Users className="h-3 w-3" /> Offentlig</>
                ) : (
                  <><Lock className="h-3 w-3" /> Privat</>
                )}
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {isAllDay && !sameDay ? (
                  <span>
                    {format(new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()), "d. MMM", { locale: nb })}
                    {" – "}
                    {format(new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()), "d. MMM yyyy", { locale: nb })}
                  </span>
                ) : (
                  <span>{format(start, "d. MMMM yyyy", { locale: nb })}</span>
                )}
              </div>
              {!isAllDay && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    {format(start, "HH:mm")} –{" "}
                    {sameDay ? format(end, "HH:mm") : format(end, "d. MMM HH:mm", { locale: nb })}
                  </span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </div>
            {event.description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
            )}
            {event.creator && (
              <p className="mt-2 text-xs text-muted-foreground">
                Av {event.creator.full_name ?? event.creator.email}
              </p>
            )}
            {!event.is_public && event.invitations && event.invitations.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {event.invitations.length} invitert
              </p>
            )}
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-1">
              <EventForm
                event={event}
                members={members}
                currentUserId={currentUserId}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Rediger hendelse"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={loading}
                aria-label="Slett hendelse"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
