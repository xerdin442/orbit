import { SearchAlert } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function NotFound() {
  return (
    <StatusPage
      icon={SearchAlert}
      title="Page not found"
      description="The page you're looking for doesn't exist or may have been moved."
      action={{ label: "Back to Dashboard", href: "/projects" }}
    />
  );
}
