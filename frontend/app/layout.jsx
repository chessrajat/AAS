import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToasterClient from "./components/ToasterClient";
import AuthGate from "./components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Advance Annotation System",
  description: "An advanced annotation system for managing and annotating datasets.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthGate>{children}</AuthGate>
        <ToasterClient />
      </body>
    </html>
  );
}
