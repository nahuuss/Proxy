import { getAdminAccessState } from "./admin-access";

export async function requireAdminRouteAccess(): Promise<Response | null> {
  const access = await getAdminAccessState();
  if (access.hasAccess) {
    return null;
  }

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
