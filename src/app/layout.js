import { Inter, Be_Vietnam_Pro, Fraunces } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import MusicPlayer from '@/components/MusicPlayer';

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
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${beVietnamPro.variable} ${fraunces.variable}`}
    >
      <body>
        <Header />
        <main>{children}</main>
        <MusicPlayer />
      </body>
    </html>
  );
}
