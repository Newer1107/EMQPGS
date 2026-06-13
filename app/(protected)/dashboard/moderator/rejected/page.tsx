import { redirect } from "next/navigation";

export default function ModeratorRejectedPage() {
  redirect("/dashboard/moderator/questions");
}
