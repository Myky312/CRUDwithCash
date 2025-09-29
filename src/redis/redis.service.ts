import { Injectable, OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit {
  private redis: Redis

  async onModuleInit() {
    this.redis = new Redis({
      host: '127.0.0.1',
      port: 6379,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    })

    this.redis.on('connect', () => {
      console.warn('Redis connected successfully!')
    })

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    // Test connection
    try {
      await this.redis.set('test', 'hello', 'EX', 5)
      const value = await this.redis.get('test')
      console.warn('Redis test value:', value)
    }
    catch (error) {
      console.error('Redis test failed:', error)
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds) {
      return this.redis.set(key, value, 'EX', ttlSeconds)
    }
    return this.redis.set(key, value)
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key)
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern)
  }

  async exists(key: string): Promise<number> {
    return this.redis.exists(key)
  }

  async flushall(): Promise<'OK'> {
    return this.redis.flushall()
  }
}
