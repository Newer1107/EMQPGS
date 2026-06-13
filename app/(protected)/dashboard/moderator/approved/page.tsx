import { redirect } from "next/navigation";

export default function ModeratorApprovedPage() {
  redirect("/dashboard/moderator/questions");
}
