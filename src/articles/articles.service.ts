// src/articles/articles.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
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
    private readonly articleRepo: Repository<Article>,
  ) {}

  async create(dto: CreateArticleDto, userId: number) {
    const user = await this.articleRepo.manager.getRepository(User).findOne({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const article = this.articleRepo.create({
      ...dto,
      author: user,
    })
    return this.articleRepo.save(article)
  }

  async findAll(page = 1, limit = 10, filters?: any) {
    const query = this.articleRepo.createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .skip((page - 1) * limit)
      .take(limit)

    if (filters?.authorId) {
      query.andWhere('author.id = :authorId', { authorId: filters.authorId })
    }
    if (filters?.publishedAfter) {
      query.andWhere('article.publishedAt >= :date', { date: filters.publishedAfter })
    }

    const [items, total] = await query.getManyAndCount()
    return { items, total, page, limit }
  }

  async findOne(id: number) {
    return this.articleRepo.findOne({ where: { id } })
  }

  async update(id: number, dto: UpdateArticleDto, userId: number) {
    const article = await this.articleRepo.findOne({
      where: { id },
      relations: ['author'], // make sure author is loaded
    })

    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author of this article')

    Object.assign(article, dto)
    return this.articleRepo.save(article)
  }

  async remove(id: number, userId: number) {
    const article = await this.articleRepo.findOne({
      where: { id },
      relations: ['author'], // load author relation
    })

    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author of this article')

    return this.articleRepo.remove(article)
  }
}
