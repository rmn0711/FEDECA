import { requireRole } from "@/lib/auth";
import { getTeamForChat, listConversations } from "@/lib/chat/service";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatFrame } from "@/components/chat/chat-frame";

// El chat es del equipo (líder y responsables), como un Slack interno.
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole("admin", "agent");
  const [lists, team] = await Promise.all([listConversations(me), getTeamForChat(me)]);
  return <ChatFrame sidebar={<ChatSidebar initial={lists} team={team} />}>{children}</ChatFrame>;
}
