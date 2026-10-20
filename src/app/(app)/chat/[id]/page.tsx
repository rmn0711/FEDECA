import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ChatError, getConversationInfo, getMessages, getTeamForChat, markRead } from "@/lib/chat/service";
import { ConversationView } from "@/components/chat/conversation-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin", "agent");
  try {
    const { conversation, other } = await getConversationInfo(me, Number((await params).id));
    return { title: conversation.kind === "dm" ? (other?.name ?? "Chat") : `#${conversation.name}` };
  } catch {
    return { title: "Chat" };
  }
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin", "agent");
  const id = Number((await params).id);
  let info: Awaited<ReturnType<typeof getConversationInfo>>;
  try {
    info = await getConversationInfo(me, id);
  } catch (e) {
    if (e instanceof ChatError) notFound();
    throw e;
  }
  const [{ messages, hasMore }, team] = await Promise.all([getMessages(me, id), getTeamForChat(me)]);
  await markRead(me, id);
  const c = info.conversation;

  return (
    <ConversationView
      key={id}
      me={{ id: me.id, name: me.name, role: me.role }}
      info={{ id: c.id, kind: c.kind, name: c.name, description: c.description, isPrivate: c.isPrivate, createdBy: c.createdBy }}
      members={info.members}
      otherMember={info.other}
      initialMessages={messages}
      initialHasMore={hasMore}
      team={team.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
