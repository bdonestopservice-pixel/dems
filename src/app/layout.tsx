import type { Metadata } from 'next'
import { Noto_Sans_Thai, Noto_Sans } from 'next/font/google'
import './globals.css'

const notoSansThai = Noto_Sans_Thai({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-noto-thai',
})

const notoSans = Noto_Sans({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans',
})

export const metadata: Metadata = {
  title: 'DEMS — Daily Employee Management System',
  description: 'ระบบจัดการพนักงานรายวัน กะการทำงาน และ Namelist ครบทุกคลัง',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={`${notoSansThai.variable} ${notoSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-ink antialiased">
        {children}
      </body>
    </html>
  )
}

