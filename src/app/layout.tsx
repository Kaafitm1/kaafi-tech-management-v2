import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaafi Tech | Student Management",
  description: "Kaafi Tech and Media Center student management system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="so"><body>{children}</body></html>;
}