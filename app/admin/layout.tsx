import "./admin.css";

export const metadata = {
  title: "Platform Admin | Dental Booking",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
