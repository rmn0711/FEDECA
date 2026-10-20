import { redirect } from "next/navigation";

// "Mis tareas" ahora vive dentro de "Mi pipeline" (solicitudes + tareas).
export default function MyTasksPage() {
  redirect("/equipo/pipeline");
}
