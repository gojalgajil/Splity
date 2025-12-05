import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Split Bill - Easy Bill Splitting with OCR',
  description: 'Split bills easily by scanning receipts with OCR and sharing via WhatsApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
