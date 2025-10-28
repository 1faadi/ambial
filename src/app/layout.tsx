import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AuthProvider from '@/providers/SessionProvider';
import { Toaster } from '@/components/ui/Sonner';
import { ReduxProvider } from '@/providers/ReduxProvider';
import { QueryProvider } from '@/providers/QueryProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Floor Plan Lighting Designer | Professional Lighting Layout Tool',
    template: '%s | Floor Plan Lighting Designer',
  },
  description:
    'Professional floor plan lighting design application. Create, manage, and visualize lighting layouts in architectural floor plans with our intuitive design tools. Perfect for architects, interior designers, and lighting professionals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} antialiased`}
      >
        <QueryProvider>
          <ReduxProvider>
            <AuthProvider>{children}</AuthProvider>
          </ReduxProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
