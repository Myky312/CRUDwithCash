import { jest } from '@jest/globals'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { EntityManager, ObjectLiteral } from 'typeorm'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { Article } from './articles.entity'
import { ArticlesService } from './articles.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

// Final types to robustly handle Jest/TypeORM conflicts

interface MockedRepository<T extends ObjectLiteral> {
  create: jest.Mock
  save: jest.Mock<() => Promise<T>>
  findOne: jest.Mock<() => Promise<T | null>>
  remove: jest.Mock<() => Promise<T>>

  createQueryBuilder: jest.Mock<() => MockQueryBuilder<T>>

  manager: Partial<EntityManager>
}

interface MockQueryBuilder<T> {
  leftJoinAndSelect: jest.Mock<() => MockQueryBuilder<T>>
  skip: jest.Mock<() => MockQueryBuilder<T>>
  take: jest.Mock<() => MockQueryBuilder<T>>
  andWhere: jest.Mock<() => MockQueryBuilder<T>>
  getManyAndCount: jest.Mock<() => Promise<[T[], number]>>
}

type MockedRedisService = jest.Mocked<RedisService>

/**
 * Mocks the TypeORM repository for Article and provides access to the mocked User repository.
 */
function mockRepository(): MockedRepository<Article> & { getUserRepoMock: MockedRepository<User> } {
  // Use Partial<MockedRepository<User>> for the userRepoMock definition
  const userRepoMock: Partial<MockedRepository<User>> = {
    findOne: jest.fn<() => Promise<User | null>>(),
  } as MockedRepository<User>

  const queryBuilderMock: MockQueryBuilder<Article> = {
    leftJoinAndSelect: jest.fn(() => queryBuilderMock),
    skip: jest.fn(() => queryBuilderMock),
    take: jest.fn(() => queryBuilderMock),
    andWhere: jest.fn(() => queryBuilderMock),
    getManyAndCount: jest.fn<() => Promise<[Article[], number]>>(),
  }

  const articleRepoMock: MockedRepository<Article> = {
    create: jest.fn(),
    save: jest.fn<() => Promise<Article>>(),
    findOne: jest.fn<() => Promise<Article | null>>(),
    remove: jest.fn<() => Promise<Article>>(),

    createQueryBuilder: jest.fn(() => queryBuilderMock) as jest.Mock<() => MockQueryBuilder<Article>>,

    // Use 'as unknown as' to bypass TypeScript's structural check on EntityManager
    manager: {
      getRepository: jest.fn(() => userRepoMock),
    } as unknown as Partial<EntityManager>,
  }

  return { ...articleRepoMock, getUserRepoMock: userRepoMock } as MockedRepository<Article> & { getUserRepoMock: MockedRepository<User> }
}

function mockRedisService(): MockedRedisService {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    flushall: jest.fn(),
  } as unknown as MockedRedisService
}

describe('articlesService', () => {
  let service: ArticlesService
  let repo: ReturnType<typeof mockRepository>
  let redis: MockedRedisService

  const mockCreateDto: CreateArticleDto = { title: 'Test', description: 'Test Desc' }

  // Define a fixed Date object for consistency across all date mocking
  const fixedDate = new Date('2025-09-29T06:33:48.013Z')

  const mockArticlePartial: Omit<Article, 'content'> = {
    id: 1,
    title: 'Test Article',
    description: 'Test Description',
    author: { id: 1 } as User,
    authorId: 1,
    publishedAt: fixedDate, // Use the fixed Date object
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useFactory: mockRepository },
        { provide: RedisService, useFactory: mockRedisService },
      ],
    }).compile()

    service = module.get<ArticlesService>(ArticlesService)
    repo = module.get(getRepositoryToken(Article)) as ReturnType<typeof mockRepository>
    redis = module.get(RedisService) as MockedRedisService
  })

  // ------------------------------------------------------------------

  describe('create', () => {
    it('should throw "User not found" if user does not exist', async () => {
      repo.getUserRepoMock.findOne!.mockResolvedValue(null)

      await expect(service.create(mockCreateDto, 1))
        .rejects
        .toThrow('User not found')
    })

    it('should create and save article', async () => {
      const user = { id: 1 } as User
      const article = {
        ...mockArticlePartial,
        content: 'Auto-generated or default content',
        author: user,
        authorId: user.id,
      } as Article

      repo.getUserRepoMock.findOne!.mockResolvedValue(user)
      repo.create!.mockReturnValue(article)
      repo.save!.mockResolvedValue(article)

      const result = await service.create(mockCreateDto, 1)

      expect(repo.create).toHaveBeenCalledWith({ ...mockCreateDto, author: user })
      expect(repo.save).toHaveBeenCalledWith(article)
      expect(result).toEqual(article)
    })
  })

  // ------------------------------------------------------------------

  describe('findAll', () => {
    // Result returned directly from TypeORM (contains Date objects)
    const dbPaginationResult = {
      items: [{ ...mockArticlePartial, content: 'x' } as Article],
      total: 1,
      page: 1,
      limit: 10,
    }

    // Result returned from Redis after JSON.parse (contains Date strings)
    const cachedPaginationResult = {
      items: [{
        ...mockArticlePartial,
        content: 'x',
        publishedAt: fixedDate.toISOString(), // Use ISO string to match JSON.parse output
      } as unknown as Article],
      total: 1,
      page: 1,
      limit: 10,
    }

    it('should return cached data', async () => {
      // Mock Redis to return the stringified CACHED object
      redis.get.mockResolvedValue(JSON.stringify(cachedPaginationResult))

      const result = await service.findAll(1, 10)

      // Expect the result to match the object containing the date string
      expect(result).toEqual(cachedPaginationResult)
      expect(repo.createQueryBuilder).not.toHaveBeenCalled()
    })

    it('should query DB and cache if no cache', async () => {
      redis.get.mockResolvedValue(null)
      const queryBuilder = repo.createQueryBuilder!()

      // Mock DB to return the raw items/total, which the service wraps with page/limit
      queryBuilder.getManyAndCount.mockResolvedValue([dbPaginationResult.items, dbPaginationResult.total])

      const result = await service.findAll(1, 10)

      // Expect the result to match the DB result (which contains the Date object AND page/limit)
      expect(result).toEqual(dbPaginationResult)

      // 💡 FIX: Update expect to match the exact key and include the TTL argument (60)
      expect(redis.set).toHaveBeenCalledWith(
        'articles:list:page:1:limit:10:author:all:after:all', // The key from the received arguments
        JSON.stringify(dbPaginationResult),
        60, // The TTL/expiration from the received arguments
      )
      expect(result.total).toBe(1)
    })
  })

  // ------------------------------------------------------------------

  describe('findOne', () => {
    it('should return cached article', async () => {
      const cachedArticle = { id: 1 }
      redis.get.mockResolvedValue(JSON.stringify(cachedArticle))

      const result = await service.findOne(1)
      expect(result).toEqual(cachedArticle)
      expect(repo.findOne).not.toHaveBeenCalled()
    })

    it('should fetch from DB and cache if not cached', async () => {
      redis.get.mockResolvedValue(null)
      const dbArticle = { ...mockArticlePartial, content: 'content' } as Article
      repo.findOne!.mockResolvedValue(dbArticle)

      const result = await service.findOne(2)
      expect(result).toEqual(dbArticle)
      expect(redis.set).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------

  describe('update', () => {
    it('should throw NotFoundException', async () => {
      repo.findOne!.mockResolvedValue(null)
      await expect(service.update(1, { title: 'x' } as UpdateArticleDto, 1))
        .rejects
        .toThrow(NotFoundException)
    })

    it('should throw ForbiddenException', async () => {
      repo.findOne!.mockResolvedValue({ ...mockArticlePartial, author: { id: 2 }, authorId: 2 } as Article)
      await expect(service.update(1, { title: 'x' } as UpdateArticleDto, 1))
        .rejects
        .toThrow(ForbiddenException)
    })

    it('should update and invalidate cache', async () => {
      const article = { ...mockArticlePartial } as Article
      const updatedArticle = { ...article, title: 'new' } as Article

      repo.findOne!.mockResolvedValue(article)
      repo.save!.mockResolvedValue(updatedArticle)

      const invalidateSpy = jest.spyOn(service as any, 'smartInvalidateArticleCache').mockResolvedValue(undefined)

      const result = await service.update(1, { title: 'new' } as UpdateArticleDto, 1)
      expect(result.title).toBe('new')
      expect(repo.save).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------

  describe('remove', () => {
    it('should throw NotFoundException', async () => {
      repo.findOne!.mockResolvedValue(null)
      await expect(service.remove(1, 1)).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException', async () => {
      repo.findOne!.mockResolvedValue({ ...mockArticlePartial, author: { id: 2 }, authorId: 2 } as Article)
      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException)
    })

    it('should remove and invalidate cache', async () => {
      const article = { ...mockArticlePartial } as Article
      repo.findOne!.mockResolvedValue(article)
      repo.remove!.mockResolvedValue(article)

      const invalidateSpy = jest.spyOn(service as any, 'smartInvalidateArticleCache').mockResolvedValue(undefined)
      const result = await service.remove(1, 1)

      expect(result).toEqual({ message: 'Deleted successfully' })
      expect(repo.remove).toHaveBeenCalledWith(article)
      expect(invalidateSpy).toHaveBeenCalled()
    })
  })
})
