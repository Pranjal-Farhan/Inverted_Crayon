import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PostEditorForm } from "@/components/admin/PostEditorForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();

  return <PostEditorForm initial={post} />;
}
