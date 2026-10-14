import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { CreateSiteDto } from './dto/create-site.dto.js';
import { ListSitesQueryDto } from './dto/list-sites-query.dto.js';
import { UpdateSiteDto } from './dto/update-site.dto.js';

// Sites are shared: anyone holding the permission (see role-permissions.ts)
// can act on every site, so there is no per-record scoping here.
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly sites: Repository<Site>,
  ) {}

  async create(actor: User, dto: CreateSiteDto): Promise<Site> {
    await this.assertCodeFree(dto.code);
    return this.sites.save(
      this.sites.create({
        name: dto.name,
        code: dto.code,
        address: dto.address ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        isActive: dto.isActive,
        createdById: actor.id,
      }),
    );
  }

  async findAll({ page, limit }: ListSitesQueryDto) {
    const [items, total] = await this.sites.findAndCount({
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  findOne(id: number): Promise<Site> {
    return this.findOneOrFail(id);
  }

  async update(id: number, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.findOneOrFail(id);
    if (dto.code && dto.code !== site.code) await this.assertCodeFree(dto.code);
    await this.sites.update(id, dto);
    return this.findOneOrFail(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOneOrFail(id);
    await this.sites.delete(id);
  }

  private async findOneOrFail(id: number): Promise<Site> {
    const site = await this.sites.findOneBy({ id });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  private async assertCodeFree(code: string): Promise<void> {
    if (await this.sites.existsBy({ code })) {
      throw new ConflictException('A site with this code already exists');
    }
  }
}
