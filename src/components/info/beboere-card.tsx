import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Contact, Phone, Mail } from "lucide-react"

type Resident = {
  id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  unit_number: string | null
  avatar_url: string | null
}

export function BeboereCard({ residents }: { residents: Resident[] }) {
  return (
    <Card id="beboere">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Contact className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Beboere</h2>
          <span className="text-xs text-muted-foreground">({residents.length})</span>
        </div>

        {residents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen godkjente beboere ennå.</p>
        ) : (
          <div className="divide-y divide-border">
            {residents.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar className="h-9 w-9 shrink-0">
                  {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.full_name ?? ""} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {(r.full_name ?? r.email ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {r.full_name ?? <span className="text-muted-foreground italic">Ukjent navn</span>}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {r.unit_number && (
                      <span className="text-xs text-muted-foreground">nr. {r.unit_number}</span>
                    )}
                    {r.phone_number && (
                      <a
                        href={`tel:${r.phone_number.replace(/\s/g, "")}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {r.phone_number}
                      </a>
                    )}
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {r.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
