import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../users/user.entity'
import { Article } from './articles.entity'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private articleRepo: Repository<Article>,
  ) {}

  async create(dto: CreateArticleDto, author: User) {
    const article = this.articleRepo.create({ ...dto, author })
    return this.articleRepo.save(article)
  }

  async findAll(page = 1, limit = 10, filters?: any) {
    const qb = this.articleRepo.createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('article.publishedAt', 'DESC')

    if (filters?.authorId) {
      qb.andWhere('author.id = :authorId', { authorId: filters.authorId })
    }
    if (filters?.publishedAfter) {
      qb.andWhere('article.publishedAt > :after', { after: filters.publishedAfter })
    }
    if (filters?.publishedBefore) {
      qb.andWhere('article.publishedAt < :before', { before: filters.publishedBefore })
    }

    const [data, total] = await qb.getManyAndCount()
    return { data, total, page, limit }
  }

  async findOne(id: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] })
    if (!article)
      throw new NotFoundException('Article not found')
    return article
  }

  async update(id: number, dto: UpdateArticleDto) {
    await this.articleRepo.update(id, dto)
    return this.findOne(id)
  }

  async remove(id: number) {
    const article = await this.findOne(id)
    return this.articleRepo.remove(article)
  }
}
