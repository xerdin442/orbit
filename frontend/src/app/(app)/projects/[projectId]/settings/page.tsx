import { redirect } from "next/navigation";

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectId) {
    redirect("/projects");
  }
  redirect(`/projects/${projectId}/settings/general`);
}
