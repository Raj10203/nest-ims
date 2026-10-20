import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleName } from '../../common/enums/role-name.enum.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { CreateSiteDto } from './dto/create-site.dto.js';
import { ListSitesQueryDto } from './dto/list-sites-query.dto.js';
import { UpdateSiteDto } from './dto/update-site.dto.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne } from '../../common/typeorm/depth-one.js';

// Sites are shared: anyone holding the permission (see role-permissions.ts)
// can act on every site, so there is no per-record scoping here.
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    @Inject(forwardRef(() => UsersService))
    // Pick, not UsersService: decorator metadata would read the class before
    // the Users <-> Sites import cycle has initialized it.
    private readonly usersService: Pick<UsersService, 'findOneFor'>,
  ) {}

  async create(actor: User, dto: CreateSiteDto): Promise<Site> {
    await this.assertCodeFree(dto.code);
    if (dto.inchargeId) await this.assertCanBeIncharge(actor, dto.inchargeId);
    const saved = await this.sites.save(
      this.sites.create({
        name: dto.name,
        code: dto.code,
        address: dto.address ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        isActive: dto.isActive,
        inchargeId: dto.inchargeId ?? null,
        createdById: actor.id,
      }),
    );
    return this.findOneOrFail(saved.id);
  }

  async findAll({ page, limit }: ListSitesQueryDto) {
    const [items, total] = await this.sites.findAndCount({
      ...depthOne(this.sites),
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  findOne(id: number): Promise<Site> {
    return this.findOneOrFail(id);
  }

  async update(actor: User, id: number, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.findOneOrFail(id);
    if (dto.code && dto.code !== site.code) await this.assertCodeFree(dto.code);
    if (dto.inchargeId && dto.inchargeId !== site.inchargeId) {
      await this.assertCanBeIncharge(actor, dto.inchargeId);
    }
    await this.sites.update(id, dto);
    return this.findOneOrFail(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOneOrFail(id);
    await this.sites.delete(id);
  }

  isInchargeOfAnySite(userId: number): Promise<boolean> {
    return this.sites.existsBy({ inchargeId: userId });
  }

  // findOneFor applies the actor's user scope, so an out-of-scope id is a 404.
  private async assertCanBeIncharge(
    actor: User,
    userId: number,
  ): Promise<void> {
    const user = await this.usersService.findOneFor(actor, userId);
    if (user.role.name !== RoleName.SITE_INCHARGE) {
      throw new BadRequestException(
        i18nMessage('errors.sites.inchargeRoleRequired', {
          id: userId,
          role: RoleName.SITE_INCHARGE,
        }),
      );
    }
  }

  private async findOneOrFail(id: number): Promise<Site> {
    const site = await this.sites.findOne({
      ...depthOne(this.sites),
      where: { id },
    });
    if (!site)
      throw new NotFoundException(i18nMessage('errors.sites.notFound', { id }));
    return site;
  }

  private async assertCodeFree(code: string): Promise<void> {
    if (await this.sites.existsBy({ code })) {
      throw new ConflictException(i18nMessage('errors.sites.codeTaken'));
    }
  }
}
