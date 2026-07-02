import { Inter, Be_Vietnam_Pro, Fraunces } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import MusicPlayer from '@/components/MusicPlayer';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata = {
  title: 'Hoàng & Duyên - 69 Project',
  description: 'Câu chuyện tình yêu của Hoàng và Duyên - 69 Project Wedding',
  keywords: ['wedding', 'hoàng', 'duyên', '69 project'],
  openGraph: {
    title: 'Hoàng & Duyên - 69 Project',
    description: 'Câu chuyện tình yêu của Hoàng và Duyên',
    url: 'https://project69hd.xyz',
    type: 'website',
    images: [
      {
        url: '/images/000064-3.webp',
        width: 1200,
        height: 630,
        alt: 'Hoàng & Duyên Cover',
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${beVietnamPro.variable} ${fraunces.variable}`}
    >
      <head>
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-V5NR1YESMV`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-V5NR1YESMV', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <MusicPlayer />
      </body>
    </html>
  );
}
