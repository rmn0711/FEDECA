import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  fullName,
  avatarUrl,
  className,
  size = "default",
}: {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} className={cn("shrink-0", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
      <AvatarFallback className="text-xs">{initials(fullName)}</AvatarFallback>
    </Avatar>
  );
}
