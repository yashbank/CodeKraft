/** Public site shell. Header/footer/story components arrive in P7; this keeps public routes static. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div data-app="site">{children}</div>;
}
