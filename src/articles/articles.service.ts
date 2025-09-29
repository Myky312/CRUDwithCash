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
    const cacheKey = this.getArticleListCacheKey(page, limit, filters)

    const cached = await this.redisService.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

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
    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), 60) // 60 seconds
    }
    catch (error) {
      console.error('Failed to store in cache:', error)
    }
    return result
  }

  async findOne(id: number) {
    const cacheKey = this.getArticleCacheKey(id)

    const cached = await this.redisService.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const article = await this.articleRepo.findOne({
      where: { id },
      relations: ['author'],
    })

    if (article) {
      // Store individual article in cache
      try {
        await this.redisService.set(cacheKey, JSON.stringify(article), 300) // 5 minutes
      }
      catch (error) {
        console.error('Failed to store article in cache:', error)
      }
    }

    return article
  }

  async update(id: number, dto: UpdateArticleDto, userId: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] })
    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author')

    Object.assign(article, dto)
    const updated = await this.articleRepo.save(article)

    await this.smartInvalidateArticleCache(id, article) // smart cache invalidation
    return updated
  }

  async remove(id: number, userId: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] })
    if (!article)
      throw new NotFoundException('Article not found')
    if (article.author.id !== userId)
      throw new ForbiddenException('You are not the author')

    await this.articleRepo.remove(article)
    await this.smartInvalidateArticleCache(id, article)
    return { message: 'Deleted successfully' }
  }

  private getCacheKey(page: number, limit: number, filters?: any) {
    const authorId = filters?.authorId || 'all'
    const publishedAfter = filters?.publishedAfter || 'all'
    return `articles:page:${page}:limit:${limit}:author:${authorId}:after:${publishedAfter}`
  }

  private getArticleCacheKey(articleId: number) {
    return `article:${articleId}`
  }

  private getArticleListCacheKey(page: number, limit: number, filters?: any) {
    const authorId = filters?.authorId || 'all'
    const publishedAfter = filters?.publishedAfter || 'all'
    return `articles:list:page:${page}:limit:${limit}:author:${authorId}:after:${publishedAfter}`
  }

  private getArticleIndexKey(articleId: number) {
    return `article:index:${articleId}`
  }

  private async addToArticleIndex(articleId: number, cacheKey: string) {
    try {
      const indexKey = this.getArticleIndexKey(articleId)
      await this.redisService.set(indexKey, cacheKey, 3600) // 1 hour
    }
    catch (error) {
      console.error('Failed to add to article index:', error)
    }
  }

  private async removeFromArticleIndex(articleId: number) {
    try {
      const indexKey = this.getArticleIndexKey(articleId)
      await this.redisService.del(indexKey)
    }
    catch (error) {
      console.error('Failed to remove from article index:', error)
    }
  }

  private async invalidateArticleCache(articleId: number) {
    try {
      // 1. Удаляем кэш конкретной статьи
      const articleKey = this.getArticleCacheKey(articleId)
      await this.redisService.del(articleKey)

      // 2. Получаем информацию о статье для умной инвалидации
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
        relations: ['author'],
      })

      if (!article) {
        return
      }

      // 3. Умная инвалидация: удаляем только релевантные списки
      const patternsToInvalidate = [
        // Все списки статей (они могут содержать измененную статью)
        'articles:list:*',
        // Списки конкретного автора
        `articles:list:*:author:${article.author.id}:*`,
        // Общие списки (без фильтра по автору)
        'articles:list:*:author:all:*',
      ]

      let _totalDeleted = 0
      for (const pattern of patternsToInvalidate) {
        const keys = await this.redisService.keys(pattern)

        for (const key of keys) {
          await this.redisService.del(key)
          _totalDeleted++
        }
      }

      // 4. Удаляем индекс статьи
      await this.removeFromArticleIndex(articleId)
    }
    catch (error) {
      console.error('Failed to invalidate cache:', error)
    }
  }

  /**
   * Умная инвалидация кэша - удаляет только те списки, которые могут содержать измененную статью
   */
  private async smartInvalidateArticleCache(articleId: number, article: any) {
    try {
      // 1. Удаляем кэш конкретной статьи
      const articleKey = this.getArticleCacheKey(articleId)
      await this.redisService.del(articleKey)

      // 2. Определяем, какие списки нужно инвалидировать
      const invalidationPatterns = [
        // Все списки статей (они могут содержать измененную статью)
        'articles:list:*',
        // Списки конкретного автора
        `articles:list:*:author:${article.author.id}:*`,
        // Общие списки (без фильтра по автору)
        'articles:list:*:author:all:*',
      ]

      let _totalDeleted = 0
      const deletedKeys = new Set<string>() // Избегаем дублирования

      for (const pattern of invalidationPatterns) {
        const keys = await this.redisService.keys(pattern)

        for (const key of keys) {
          if (!deletedKeys.has(key)) {
            await this.redisService.del(key)
            deletedKeys.add(key)
            _totalDeleted++
          }
        }
      }

      // 3. Удаляем индекс статьи
      await this.removeFromArticleIndex(articleId)
    }
    catch (error) {
      console.error('Failed to smart invalidate cache:', error)
    }
  }
}
