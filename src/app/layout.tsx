import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="th">
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

