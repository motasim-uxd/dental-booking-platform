import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { createBot } from "@/lib/admin/tenant-admin";
import type { BotType } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: tenantId } = await context.params;
  const body = await req.json().catch(() => null);

  try {
    const bot = await createBot(tenantId, {
      botKey: String(body?.botKey ?? ""),
      botType: (body?.botType ?? "other") as BotType,
      displayName: body?.displayName,
      enabled: body?.enabled,
      lexBotId: body?.lexBotId,
      lexBotAlias: body?.lexBotAlias,
      lambdaArn: body?.lambdaArn,
      connectFlowArn: body?.connectFlowArn,
    });
    return NextResponse.json({ bot }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Create bot failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
