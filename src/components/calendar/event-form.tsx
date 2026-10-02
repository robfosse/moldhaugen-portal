"use client"

import { useState } from "react"
import { createEvent, updateEvent } from "@/app/(dashboard)/calendar/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import type { Event, ProfileSummary } from "@/types"

type Props = {
  members: ProfileSummary[]
  currentUserId: string
  /** When set, the form edits this event instead of creating a new one */
  event?: Event
  /** Custom trigger element (defaults to the "Ny hendelse" button) */
  trigger?: React.ReactNode
}

const pad = (n: number) => String(n).padStart(2, "0")
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const utcDateStr = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

// All-day events (e.g. tool loans) are stored as UTC midnight
function isAllDayEvent(e: Event) {
  const s = new Date(e.start_time)
  const en = new Date(e.end_time)
  return s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && en.getUTCHours() === 0 && en.getUTCMinutes() === 0
}

/** Accepts "930", "0930", "9:30", "9.30", "9" → "09:30" / "09:00". Returns null if invalid. */
function normalizeTime(raw: string): string | null {
  const v = raw.trim().replace(/[.,]/g, ":")
  let h: number, m: number
  if (v.includes(":")) {
    const [a, b = "0"] = v.split(":")
    h = Number(a); m = Number(b)
  } else if (/^\d{1,2}$/.test(v)) {
    h = Number(v); m = 0
  } else if (/^\d{3,4}$/.test(v)) {
    h = Number(v.slice(0, -2)); m = Number(v.slice(-2))
  } else {
    return null
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${pad(h)}:${pad(m)}`
}

function initialState(event?: Event) {
  if (event) {
    const allDay = isAllDayEvent(event)
    const s = new Date(event.start_time)
    const e = new Date(event.end_time)
    return {
      allDay,
      startDate: allDay ? utcDateStr(s) : dateStr(s),
      startTime: allDay ? "09:00" : timeStr(s),
      endDate: allDay ? utcDateStr(e) : dateStr(e),
      endTime: allDay ? "10:00" : timeStr(e),
      isPublic: event.is_public,
      invited: (event.invitations ?? []).map((i) => i.user_id),
    }
  }
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    allDay: false,
    startDate: dateStr(start),
    startTime: timeStr(start),
    endDate: dateStr(end),
    endTime: timeStr(end),
    isPublic: true,
    invited: [] as string[],
  }
}

/** Plain text field so mobile shows the numeric keypad instead of a picker */
function TimeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="tt:mm"
      maxLength={5}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        const n = normalizeTime(value)
        if (n) onChange(n)
      }}
    />
  )
}

export function EventForm({ members, currentUserId, event, trigger }: Props) {
  const isEdit = !!event
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => initialState(event))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const otherMembers = members.filter((m) => m.id !== currentUserId)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function handleOpenChange(next: boolean) {
    // Reset to the event's current values (or fresh defaults) every time the dialog opens
    if (next) {
      setForm(initialState(event))
      setError(null)
    }
    setOpen(next)
  }

  function toggleInvite(id: string) {
    set("invited", form.invited.includes(id) ? form.invited.filter((x) => x !== id) : [...form.invited, id])
  }

  function setStartDate(v: string) {
    // Keep end date from falling before start date
    setForm((f) => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    let startIso: string, endIso: string
    if (form.allDay) {
      if (!form.startDate || !form.endDate) return setError("Velg start- og sluttdato")
      startIso = `${form.startDate}T00:00:00Z`
      endIso = `${form.endDate}T00:00:00Z`
    } else {
      const st = normalizeTime(form.startTime)
      const et = normalizeTime(form.endTime)
      if (!form.startDate || !form.endDate) return setError("Velg start- og sluttdato")
      if (!st || !et) return setError("Ugyldig klokkeslett – bruk formatet tt:mm, f.eks. 18:30")
      // Interpret as the user's local time, store as UTC
      startIso = new Date(`${form.startDate}T${st}`).toISOString()
      endIso = new Date(`${form.endDate}T${et}`).toISOString()
    }
    if (endIso < startIso) return setError("Slutt kan ikke være før start")

    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set("start_time", startIso)
    fd.set("end_time", endIso)
    fd.set("is_public", String(form.isPublic))
    form.invited.forEach((id) => fd.append("invited", id))
    const result = isEdit ? await updateEvent(event.id, fd) : await createEvent(fd)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ny hendelse</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger hendelse" : "Opprett hendelse"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Tittel *</Label>
            <Input id="title" name="title" placeholder="Hendelsens tittel" defaultValue={event?.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea id="description" name="description" placeholder="Valgfri beskrivelse" rows={2} defaultValue={event?.description ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Sted</Label>
            <Input id="location" name="location" placeholder="f.eks. Fellesarealet" defaultValue={event?.location ?? ""} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="all_day"
              checked={form.allDay}
              onCheckedChange={(v) => set("allDay", v === true)}
            />
            <label htmlFor="all_day" className="text-sm cursor-pointer">Hele dagen</label>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start *</Label>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Input id="start_date" type="date" value={form.startDate} onChange={(e) => setStartDate(e.target.value)} required className={form.allDay ? "col-span-2" : ""} />
                {!form.allDay && (
                  <TimeInput id="start_time" value={form.startTime} onChange={(v) => set("startTime", v)} />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Slutt *</Label>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Input id="end_date" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set("endDate", e.target.value)} required className={form.allDay ? "col-span-2" : ""} />
                {!form.allDay && (
                  <TimeInput id="end_time" value={form.endTime} onChange={(v) => set("endTime", v)} />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Synlighet</p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => set("isPublic", true)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  form.isPublic ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                Offentlig
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Alle beboere kan se dette</p>
              </button>
              <button
                type="button"
                onClick={() => set("isPublic", false)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  !form.isPublic ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                Privat
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Kun inviterte beboere</p>
              </button>
            </div>

            {!form.isPublic && otherMembers.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inviter beboere</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {otherMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`invite-${member.id}`}
                        checked={form.invited.includes(member.id)}
                        onCheckedChange={() => toggleInvite(member.id)}
                      />
                      <label htmlFor={`invite-${member.id}`} className="text-sm cursor-pointer">
                        {member.full_name ?? member.email}
                        {member.unit_number && <span className="text-muted-foreground ml-1">({member.unit_number})</span>}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!form.isPublic && otherMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">Ingen andre beboere å invitere ennå.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
            <Button type="submit" disabled={loading}>
              {isEdit
                ? (loading ? "Lagrer…" : "Lagre endringer")
                : (loading ? "Oppretter…" : "Opprett hendelse")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
