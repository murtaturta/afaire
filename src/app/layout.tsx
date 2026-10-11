import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TimerTicker } from "@/components/timer/TimerTicker";
import { TimerDrawer } from "@/components/timer/TimerDrawer";
import { BottomTimeline } from "@/components/timeline/BottomTimeline";
import { TaskCompletionProvider } from "@/context/TaskCompletionContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "afaire — adaptive task manager",
  description: "A task manager that adapts to your actual pace and work habits",
  manifest: "./manifest.json",
  icons: {
    icon: "./icon.svg",
    apple: "./icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "afaire",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col md:flex-row bg-background text-foreground">
        <TaskCompletionProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-36 md:pb-28">{children}</main>
          <TimerTicker />
          <TimerDrawer />
          <BottomTimeline />
        </TaskCompletionProvider>
      </body>
    </html>
  );
}
