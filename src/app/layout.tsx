import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TimerTicker } from "@/components/timer/TimerTicker";
import { TimerDrawer } from "@/components/timer/TimerDrawer";
import { BottomTimeline } from "@/components/timeline/BottomTimeline";
import { TaskCompletionProvider } from "@/context/TaskCompletionContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "afaire — adaptive task manager",
  description: "A task manager that adapts to your actual pace and work habits",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <TaskCompletionProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-28">{children}</main>
          <TimerTicker />
          <TimerDrawer />
          <BottomTimeline />
        </TaskCompletionProvider>
      </body>
    </html>
  );
}
