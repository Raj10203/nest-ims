import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity.js';
import { Product } from '../../entities/product.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category]), AuthorizationModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
