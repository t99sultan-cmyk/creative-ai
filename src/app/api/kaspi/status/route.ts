/**
 * GET /api/kaspi/status?operationId=...
 *
 * Клиентский polling: KaspiPushButton каждые 3 сек пингует этот endpoint
 * пока pending не сменится на topup/failed/expired.
 *
 * Scoped по userId — один юзер не может прочитать чужой статус.
 */
import { auth } from "@/lib/auth/clerk-compat";
import { db } from "@/db";
import { billingTransactions } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const operationId = url.searchParams.get("operationId");
  if (!operationId) {
    return Response.json({ error: "missing_operationId" }, { status: 400 });
  }

  const rows = await db
    .select({
      type: billingTransactions.type,
      balanceAfter: billingTransactions.balanceAfter,
      receiptUrl: billingTransactions.receiptUrl,
      impulses: billingTransactions.impulses,
    })
    .from(billingTransactions)
    .where(
      and(
        eq(billingTransactions.externalId, operationId),
        eq(billingTransactions.userId, userId),
      ),
    )
    .orderBy(desc(billingTransactions.createdAt))
    .limit(1);

  const tx = rows[0];
  if (!tx) return Response.json({ status: "not_found" });

  return Response.json({
    status: tx.type,
    balanceAfter: tx.balanceAfter,
    receiptUrl: tx.receiptUrl,
    impulses: tx.impulses,
  });
}
