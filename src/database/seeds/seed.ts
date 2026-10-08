import { DataSource } from 'typeorm';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import { hashSecret } from '../../common/security/secret-hash.js';
import { env } from '../../config/env.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { User } from '../../entities/user.entity.js';
import { ROLE_PERMISSIONS } from './role-permissions.js';

// Idempotent: safe to run after every migration.
export async function seed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const permissionRepo = manager.getRepository(Permission);
    const roleRepo = manager.getRepository(Role);
    const userRepo = manager.getRepository(User);

    const wanted = new Map<string, readonly [string, string]>();
    for (const defs of Object.values(ROLE_PERMISSIONS)) {
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

    // Roles: upsert level, replace the permission set.
    for (const name of Object.values(RoleName)) {
      const role =
        (await roleRepo.findOne({ where: { name } })) ??
        roleRepo.create({ name });
      role.level = ROLE_LEVELS[name];
      role.permissions = ROLE_PERMISSIONS[name].map(([action, subject]) =>
        byKey.get(`${action}:${subject}`)!,
      );
      await roleRepo.save(role);
    }

    // First super admin (only created, never overwritten).
    if (!(await userRepo.existsBy({ email: env.SEED_SUPER_ADMIN_EMAIL }))) {
      const superAdminRole = await roleRepo.findOneByOrFail({
        name: RoleName.SUPER_ADMIN,
      });
      await userRepo.save(
        userRepo.create({
          firstName: env.SEED_SUPER_ADMIN_FIRST_NAME,
          middleName: null,
          lastName: env.SEED_SUPER_ADMIN_LAST_NAME,
          email: env.SEED_SUPER_ADMIN_EMAIL.toLowerCase(),
          password: await hashSecret(env.SEED_SUPER_ADMIN_PASSWORD),
          emailVerifiedAt: new Date(),
          roleId: superAdminRole.id,
          createdById: null,
        }),
      );
      console.log(`Created super admin ${env.SEED_SUPER_ADMIN_EMAIL}`);
    }
  });
}
