import { PrismaClient } from "@prisma/client";
import { DEFAULT_OPERATORY_RULES } from "../lib/pms/operatory-rules";

const prisma = new PrismaClient();

async function main() {
  const webFormAccessCode = process.env.WEB_FORM_PREVIEW_CODE?.trim() || null;
  const seedPhone = process.env.SEED_TENANT_PHONE_E164?.trim() || null;

  const tenant = await prisma.tenant.upsert({
    where: { slug: "smilesquad" },
    create: {
      slug: "smilesquad",
      name: "Smile Squad Pediatric Dentistry",
      status: "active",
      features: { voice: true, webForm: true },
      branding: {
        displayName: "Smile Squad",
        tagline: "Pediatric Dentistry",
        address: "355 W Main St, Leola, PA 17540",
        phone: "+1 (717) 884-8807",
        websiteUrl: "https://smilesquad.kids/",
      },
      maxBots: 8,
      webFormAccessCode,
    },
    update: {
      name: "Smile Squad Pediatric Dentistry",
      webFormAccessCode: webFormAccessCode ?? undefined,
    },
  });

  await prisma.tenantPmsConfig.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      pmsType: "oryx",
      config: {
        realm: "smilesquadpd",
        baseUrl: "https://mychart.myoryx.com",
      },
      operatoryRules: DEFAULT_OPERATORY_RULES as object,
    },
    update: {
      pmsType: "oryx",
      config: {
        realm: "smilesquadpd",
        baseUrl: "https://mychart.myoryx.com",
      },
      operatoryRules: DEFAULT_OPERATORY_RULES as object,
    },
  });

  const bot = await prisma.tenantBot.upsert({
    where: {
      tenantId_botKey: { tenantId: tenant.id, botKey: "booking" },
    },
    create: {
      tenantId: tenant.id,
      botKey: "booking",
      botType: "booking",
      enabled: true,
      capabilities: { book: true, availability: true, inbound: true },
      promptsConfig: { displayName: "Amy", role: "receptionist" },
    },
    update: {
      botType: "booking",
      enabled: true,
      capabilities: { book: true, availability: true, inbound: true },
      promptsConfig: { displayName: "Amy", role: "receptionist" },
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, status: "active" },
    update: {},
  });

  if (seedPhone) {
    await prisma.tenantPhoneNumber.upsert({
      where: { e164: seedPhone },
      create: {
        tenantId: tenant.id,
        botId: bot.id,
        e164: seedPhone,
        label: "Primary booking DID",
      },
      update: {
        tenantId: tenant.id,
        botId: bot.id,
        label: "Primary booking DID",
      },
    });
    console.log(`Seeded phone ${seedPhone} → tenant smilesquad / bot booking`);
  }

  console.log(`Seeded tenant: ${tenant.slug} (${tenant.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
