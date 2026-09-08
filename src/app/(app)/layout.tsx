import BottomNav from '../../components/BottomNav';

// All authenticated routes are dynamic — they need the user session
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1 pb-20 overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
