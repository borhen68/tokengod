import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Enter the tank",
  description: "Verify AI spend and Stripe revenue, then publish your TokenGod card.",
};

export default function SubmitPage() {
  redirect("/?enter=1&bid=300");
}
