import { ShieldAlert } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function ForbiddenPage() {
  return (
    <StatusPage
      icon={ShieldAlert}
      title="Access denied"
      description="You don't have permission to access this resource."
      action={{ label: "Back to Dashboard", href: "/projects" }}
    />
  );
}
