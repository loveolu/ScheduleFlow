import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Skip known routes
  if (["dashboard", "login", "signup", "api", "booking", "polls", "route"].includes(username)) {
    notFound();
  }

  const user = await db.user.findUnique({
    where: { username },
    select: {
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      eventTypes: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          duration: true,
          color: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <Avatar className="w-20 h-20 mx-auto mb-4">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="text-xl bg-indigo-100 text-indigo-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
          {user.bio && (
            <p className="text-slate-500 mt-2 max-w-md mx-auto">{user.bio}</p>
          )}
        </div>

        {user.eventTypes.length === 0 ? (
          <p className="text-center text-slate-400">No event types available.</p>
        ) : (
          <div className="space-y-3">
            {user.eventTypes.map((et) => (
              <Link
                key={et.id}
                href={`/${username}/${et.slug}`}
                className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-1.5 h-12 rounded-full shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {et.title}
                    </h3>
                    {et.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">
                        {et.description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 shrink-0">
                    {et.duration} min
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-xs text-slate-400">
            Powered by{" "}
            <Link href="/" className="text-indigo-500 hover:underline">
              ScheduleFlow
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
