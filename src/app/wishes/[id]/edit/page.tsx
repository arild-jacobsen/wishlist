import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getWishById } from "@/lib/wishes";
import { notFound, redirect } from "next/navigation";
import { EditWishForm } from "@/components/EditWishForm";

export default async function EditWishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const viewerId = Number(session!.user!.id);
  const db = getDb();

  const wish = getWishById(db, Number(id));
  if (!wish) notFound();
  if (wish.user_id !== viewerId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="mx-auto max-w-2xl px-6 py-8">
        <EditWishForm wish={wish} />
      </main>
    </div>
  );
}
