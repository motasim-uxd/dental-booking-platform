import { redirect } from "next/navigation";

/** Legacy MVP home — send patients to the tenant web booking flow. */
export default function Home() {
  redirect("/book");
}
