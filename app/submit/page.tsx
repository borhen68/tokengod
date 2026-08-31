import { redirect } from "next/navigation";

export default function SubmitPage() {
  redirect("/?join=1");
}
