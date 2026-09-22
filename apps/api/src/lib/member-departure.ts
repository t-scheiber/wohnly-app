import type { Prisma } from "@prisma/client";

export async function cleanMemberDeparture(tx: Prisma.TransactionClient, householdId: string, userId: string) {
  await tx.todo.deleteMany({ where: { householdId, isPersonal: true, creatorId: userId } });
  await tx.shoppingItem.deleteMany({ where: { householdId, isPersonal: true, addedBy: userId } });
  await tx.event.deleteMany({ where: { householdId, visibility: "personal", creatorId: userId } });
  const owner = await tx.householdMember.findFirst({ where: { householdId, userId: { not: userId }, role: "OWNER" } });
  if (!owner) {
    const successor = await tx.householdMember.findFirst({ where: { householdId, userId: { not: userId } }, orderBy: { joinedAt: "asc" } });
    if (successor) await tx.householdMember.update({ where: { id: successor.id }, data: { role: "OWNER" } });
  }
}
