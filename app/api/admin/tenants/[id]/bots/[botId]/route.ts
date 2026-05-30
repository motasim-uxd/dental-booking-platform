import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { deleteBot, updateBot } from "@/lib/admin/tenant-admin";
import type { BotType } from "@prisma/client";

type Ctx = { params: Promise<{ id: string; botId: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { botId } = await context.params;
  const body = await req.json().catch(() => null);

  const bot = await updateBot(botId, {
    botType: body?.botType as BotType | undefined,
    displayName: body?.displayName,
    enabled: body?.enabled,
    lexBotId: body?.lexBotId,
    lexBotAlias: body?.lexBotAlias,
    lambdaArn: body?.lambdaArn,
    connectFlowArn: body?.connectFlowArn,
  });

  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bot });
}

export async function DELETE(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { botId } = await context.params;
  try {
    await deleteBot(botId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
