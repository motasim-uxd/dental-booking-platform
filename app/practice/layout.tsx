import "../admin/admin.css";

export const metadata = {
  title: "Practice portal | Dental Booking",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
