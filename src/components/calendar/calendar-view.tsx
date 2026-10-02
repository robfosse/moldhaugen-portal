"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday, parseISO, isWithinInterval,
} from "date-fns"
import { nb } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EventCard } from "./event-card"
import { AssignmentCalendarCard } from "./assignment-calendar-card"
import { createClient } from "@/lib/supabase/client"
import type { Event as CalEvent, MaintenanceAssignment, ProfileSummary } from "@/types"

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]

type Props = {
  events: CalEvent[]
  assignments: MaintenanceAssignment[]
  members: ProfileSummary[]
  currentUserId: string
}

type ListItem =
  | { type: "event"; date: Date; data: CalEvent }
  | { type: "assignment"; date: Date; data: MaintenanceAssignment }

export function CalendarView({ events, assignments, members, currentUserId }: Props) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("calendar")
      .on("broadcast", { event: "refresh" }, () => router.refresh())
      .subscribe()
    const poll = setInterval(() => router.refresh(), 5_000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [router])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let cur = calStart
    while (cur <= calEnd) {
      days.push(new Date(cur))
      cur = addDays(cur, 1)
    }
    return days
  }, [currentMonth])

  const eventDates = useMemo(() => events.map((e) => parseISO(e.start_time)), [events])

  const assignmentRanges = useMemo(() => assignments
    .filter((a) => !!a.scheduled_date)
    .map((a) => {
      const start = parseISO(a.scheduled_date! + "T00:00:00")
      let end = start
      switch (a.plan?.recurrence) {
        case "weekly":   end = addDays(start, 6); break
        case "biweekly": end = addDays(start, 13); break
        case "monthly":  end = addMonths(start, 1); break
      }
      return { start, end, id: a.id }
    }), [assignments])

  function hasEvent(day: Date) { return eventDates.some((d) => isSameDay(d, day)) }
  function hasAssignment(day: Date) {
    return assignmentRanges.some(({ start, end }) =>
      isSameDay(day, start) || isWithinInterval(day, { start, end })
    )
  }

  function handleDayClick(day: Date) {
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))
  }

  const dayItems = useMemo<ListItem[]>(() => {
    if (!selectedDay) return []
    return [
      ...events
        .filter((e) => isSameDay(parseISO(e.start_time), selectedDay))
        .map((e) => ({ type: "event" as const, date: parseISO(e.start_time), data: e })),
      ...assignments
        .filter((a) => {
          if (!a.scheduled_date) return false
          const range = assignmentRanges.find((r) => r.id === a.id)
          if (!range) return false
          return isSameDay(range.start, selectedDay) || isWithinInterval(selectedDay, { start: range.start, end: range.end })
        })
        .map((a) => ({ type: "assignment" as const, date: parseISO(a.scheduled_date! + "T00:00:00"), data: a })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [selectedDay, events, assignments, assignmentRanges])

  const upcomingItems = useMemo<ListItem[]>(() => {
    const now = new Date()
    // Skip anything already listed under the selected day
    const shown = new Set(dayItems.map((i) => `${i.type}-${i.data.id}`))
    return [
      ...events
        .filter((e) => new Date(e.end_time) >= now)
        .map((e) => ({ type: "event" as const, date: parseISO(e.start_time), data: e })),
      ...assignments
        .filter((a) => !!a.scheduled_date)
        .map((a) => ({
          type: "assignment" as const,
          date: parseISO(a.scheduled_date! + "T00:00:00"),
          data: a,
        })),
    ]
      .filter((i) => !shown.has(`${i.type}-${i.data.id}`))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [dayItems, events, assignments])

  function renderItems(items: ListItem[]) {
    return (
      <div className="space-y-3">
        {items.map((item) =>
          item.type === "event" ? (
            <EventCard key={`e-${item.data.id}`} event={item.data} currentUserId={currentUserId} members={members} />
          ) : (
            <Link
              key={`a-${item.data.id}`}
              href={`/maintenance#${item.data.plan?.id ?? ""}`}
              className="block hover:opacity-80 transition-opacity"
            >
              <AssignmentCalendarCard assignment={item.data} />
            </Link>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => { setCurrentMonth((m) => subMonths(m, 1)); setSelectedDay(null) }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: nb })}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => { setCurrentMonth((m) => addMonths(m, 1)); setSelectedDay(null) }}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)
            const selected = selectedDay ? isSameDay(selectedDay, day) : false
            const hasEv = hasEvent(day)
            const hasAss = hasAssignment(day)
            const borderRight = (i + 1) % 7 !== 0 ? "border-r" : ""
            const borderBottom = i < calendarDays.length - 7 ? "border-b" : ""

            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                className={[
                  "relative min-h-[56px] p-1.5 flex flex-col items-center gap-1 transition-colors border-border",
                  borderRight,
                  borderBottom,
                  !inMonth ? "bg-muted/20" : "hover:bg-muted/40",
                  selected ? "bg-primary/10 hover:bg-primary/10" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium leading-none",
                    today ? "bg-primary text-primary-foreground" : "",
                    !inMonth ? "text-muted-foreground/40" : "text-foreground",
                    selected && !today ? "ring-2 ring-primary" : "",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
                {(hasEv || hasAss) && (
                  <div className="flex gap-0.5">
                    {hasEv && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {hasAss && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary inline-block" />
          Hendelse
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
          Vedlikehold
        </span>
      </div>

      {/* Selected day */}
      {selectedDay && dayItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {format(selectedDay, "d. MMMM yyyy", { locale: nb })}
          </h3>
          {renderItems(dayItems)}
        </div>
      )}

      {/* Upcoming */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Kommende
        </h3>
        {upcomingItems.length > 0 ? (
          renderItems(upcomingItems)
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Ingen kommende hendelser</p>
        )}
      </div>
    </div>
  )
}
