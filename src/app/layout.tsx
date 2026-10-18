import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import Script from "next/script"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Moldhaugen Portal",
  description: "Nabolagsportalen for Moldhaugen Borettslag",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Moldhaugen", statusBarStyle: "black-translucent" },
  icons: {
    apple: [{ url: "/api/icons/pwa/apple", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/api/icons/pwa/192", sizes: "192x192", type: "image/png" },
      { url: "/api/icons/pwa/512", sizes: "512x512", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="no" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Script id="sw-register" strategy="beforeInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`}
        </Script>
      </body>
    </html>
  )
}
