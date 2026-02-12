import { Inter } from "next/font/google";
import "./globals.css";

// प्रीमियम फॉन्ट (Apple जैसा साफ लुक)
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Aura Analyze | Live Data Feed",
  description: "Real-time color trading analysis dashboard",
  icons: {
    icon: '/next.svg', // पब्लिक फोल्डर में लोगो
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
