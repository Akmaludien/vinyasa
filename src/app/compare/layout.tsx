import type { Metadata } from "next";

/* The page is reachable by URL but deliberately unlinked while FEATURES.abCompare
   is off, so keep it out of search results too. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
