import { redirect } from "next/navigation";

// Signup is handled via Google SSO on the login page
export default function SignupPage() {
  redirect("/login");
}
