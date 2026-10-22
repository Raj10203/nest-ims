import { DataSource, IsNull } from 'typeorm';
import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { hashSecret } from '../../common/security/secret-hash.js';
import { getSeedEnv } from '../../config/seed-env.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  FEATURE_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
} from './role-permissions.js';

const HQ_SITE_ID = 1;

// Idempotent: safe to run after every migration.
export async function seed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const permissionRepo = manager.getRepository(Permission);
    const roleRepo = manager.getRepository(Role);
    const userRepo = manager.getRepository(User);
    const siteRepo = manager.getRepository(Site);

    const wanted = new Map<string, readonly [string, string]>();
    for (const defs of [
      ...Object.values(ROLE_PERMISSIONS),
      ...Object.values(FEATURE_ROLE_PERMISSIONS),
    ]) {
      for (const def of defs) wanted.set(def.join(':'), def);
    }

    // Permissions: add missing, remove ones no role defines any more.
    const existing = await permissionRepo.find();
    const byKey = new Map(existing.map((p) => [`${p.action}:${p.subject}`, p]));
    const stale = existing.filter(
      (p) => !wanted.has(`${p.action}:${p.subject}`),
    );
    if (stale.length) await permissionRepo.remove(stale);
    for (const [key, [action, subject]] of wanted) {
      if (!byKey.has(key)) {
        byKey.set(key, await permissionRepo.save({ action, subject }));
      }
    }

    // Roles: upsert kind and level, replace the permission set.
    const roles = [
      ...Object.values(RoleName).map((name) => ({
        name,
        kind: RoleKind.PRIMARY,
        level: ROLE_LEVELS[name],
        permissions: ROLE_PERMISSIONS[name],
      })),
      ...Object.values(FeatureRoleName).map((name) => ({
        name,
        kind: RoleKind.FEATURE,
        level: 0,
        permissions: FEATURE_ROLE_PERMISSIONS[name],
      })),
    ];
    for (const { name, kind, level, permissions } of roles) {
      const role =
        (await roleRepo.findOne({ where: { name } })) ??
        roleRepo.create({ name });
      role.kind = kind;
      role.level = level;
      role.permissions = permissions.map(([action, subject]) =>
        byKey.get(`${action}:${subject}`)!,
      );
      await roleRepo.save(role);
    }

    // Headquarters always has id 1. A different site already holding id 1 is
    // a setup error, not something to repair by guessing.
    let hq = await siteRepo.findOneBy({ type: SiteType.HQ });
    if (!hq) {
      if (await siteRepo.existsBy({ id: HQ_SITE_ID })) {
        throw new Error(
          `Site ${HQ_SITE_ID} exists but is not the headquarters; fix the sites table first`,
        );
      }
      hq = await siteRepo.save(
        siteRepo.create({
          id: HQ_SITE_ID,
          name: 'Headquarters',
          code: 'HQ',
          address: null,
          city: 'Mahesana',
          state: 'Gujarat',
          pincode: '384002',
          type: SiteType.HQ,
          isActive: true,
        }),
      );
      console.log('Created the headquarters site');
    }
    await userRepo.update({ siteId: IsNull() }, { siteId: hq.id });

    // First super admin: created only when no super admin exists yet, so the
    // SEED_SUPER_ADMIN_* variables are only needed on the very first run.
    const superAdminRole = await roleRepo.findOneByOrFail({
      name: RoleName.SUPER_ADMIN,
    });
    if (!(await userRepo.existsBy({ roleId: superAdminRole.id }))) {
      const seedEnv = getSeedEnv();
      await userRepo.save(
        userRepo.create({
          firstName: seedEnv.SEED_SUPER_ADMIN_FIRST_NAME,
          middleName: null,
          lastName: seedEnv.SEED_SUPER_ADMIN_LAST_NAME,
          email: seedEnv.SEED_SUPER_ADMIN_EMAIL.toLowerCase(),
          password: await hashSecret(seedEnv.SEED_SUPER_ADMIN_PASSWORD),
          emailVerifiedAt: new Date(),
          roleId: superAdminRole.id,
          siteId: hq.id,
          createdById: null,
        }),
      );
      console.log(`Created super admin ${seedEnv.SEED_SUPER_ADMIN_EMAIL}`);
    }
  });
}
