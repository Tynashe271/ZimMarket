import type { Metadata } from 'next';
import '../src/styles.css';
import '../src/customer-dashboard.css';
import '../src/cart.css';
import './landing-v2.css';

export const metadata: Metadata = {
  title: "ZimMarket — Zimbabwe's marketplace",
  description: 'Discover trusted Zimbabwean businesses, products and services.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
