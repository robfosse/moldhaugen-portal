import { redirect } from "next/navigation"

// Beboere now lives on the Nyttig info page
export default function BeboerePage() {
  redirect("/info#beboere")
}
