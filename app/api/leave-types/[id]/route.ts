import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.leaveType.delete({
    where: { id: Number(id) },
  });

  return Response.json({ success: true });
}
