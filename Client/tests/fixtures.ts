import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { PrismaClient } =
  require('../../Server/node_modules/@prisma/client') as typeof import('../../Server/node_modules/@prisma/client');
const emails = new Set<string>();
export const trackEmail = (email: string) => emails.add(email);

export async function cleanupBrowserFixtures() {
  if (!emails.size) return;
  const envPath = path.resolve(process.cwd(), '../Server/.env');
  const databaseUrl =
    process.env.DATABASE_URL ??
    (existsSync(envPath)
      ? readFileSync(envPath, 'utf8')
          .match(/^DATABASE_URL=(.+)$/m)?.[1]
          ?.trim()
      : undefined);
  if (!databaseUrl) throw new Error('DATABASE_URL is required to clean browser fixtures');
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const users = await db.user.findMany({
      where: { email: { in: [...emails] }, name: 'Browser QA' },
      include: { memberships: true },
    });
    const orgIds = users.flatMap((u) =>
      u.memberships.filter((m) => m.role === 'OWNER').map((m) => m.organizationId),
    );
    await db.bill.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    emails.clear();
  } finally {
    await db.$disconnect();
  }
}
