/* eslint-disable no-console */
// src/articles/articles.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { Article } from './articles.entity'

import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly redisService: RedisService,
  ) {
    console.log('ArticlesService constructor called with Redis service:', !!this.redisService)
  }

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
    console.log('ArticlesService.findAll called with Redis service:', !!this.redisService)
    const cacheKey = this.getCacheKey(page, limit, filters)
    console.log('Looking for cache key:', cacheKey)

    const cached = await this.redisService.get(cacheKey)
    if (cached) {
      console.log('Cache hit!', cacheKey)
      return JSON.parse(cached)
    }
    console.log('Cache miss, querying DB', cacheKey)

    const query = this.articleRepo.createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .skip((page - 1) * limit)
      .take(limit)

    if (filters?.authorId)
      query.andWhere('author.id = :authorId', { authorId: filters.authorId })
    if (filters?.publishedAfter)
      query.andWhere('article.publishedAt >= :date', { date: filters.publishedAfter })

    const [items, total] = await query.getManyAndCount()
    const result = { items, total, page, limit }

    // Store cache with TTL
    console.log('Storing in cache:', cacheKey)
    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), 60) // 60 seconds
      console.log('Successfully stored in cache')
    }
    catch (error) {
      console.error('Failed to store in cache:', error)
    }
    return result
  }

  async findOne(id: number) {
    return this.articleRepo.findOne({ where: { id } })
  }

  async update(id: number, dto: UpdateArticleDto, userId: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] })
    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author')

    Object.assign(article, dto)
    const updated = await this.articleRepo.save(article)

    await this.invalidateArticleCache(id) // smart cache invalidation
    return updated
  }

  async remove(id: number, userId: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] })
    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author')

    await this.articleRepo.remove(article)
    await this.invalidateArticleCache(id)
    return { message: 'Deleted successfully' }
  }

  private getCacheKey(page: number, limit: number, filters?: any) {
    const authorId = filters?.authorId || 'all'
    const publishedAfter = filters?.publishedAfter || 'all'
    return `articles:page:${page}:limit:${limit}:author:${authorId}:after:${publishedAfter}`
  }

  private async invalidateArticleCache(_articleId: number) {
    // get all keys that match pattern: articles:*
    try {
      const keys: string[] = await this.redisService.keys('articles:*')
      console.log('Found cache keys to invalidate:', keys)
      for (const key of keys) {
        await this.redisService.del(key)
        console.log('Deleted cache key:', key)
      }
    }
    catch (error) {
      console.error('Failed to invalidate cache:', error)
    }
  }

  async onModuleInit() {
    try {
      await this.redisService.set('ping', 'pong', 5) // 5 seconds
      console.log('Redis cache connected!')

      // Test cache retrieval
      const testValue = await this.redisService.get('ping')
      console.log('Cache test value:', testValue)
    }
    catch (err) {
      console.error('Redis connection failed:', err)
    }
  }
}
