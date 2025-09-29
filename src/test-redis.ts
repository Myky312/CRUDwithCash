/* eslint-disable no-console */
import Redis from 'ioredis'

async function testRedis() {
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
  })

  try {
    await redis.set('test-key', 'test-value', 'EX', 10)
    const value = await redis.get('test-key')
    console.log('Redis test successful:', value)

    const keys = await redis.keys('*')
    console.log('All keys:', keys)

    await redis.disconnect()
  }
  catch (error) {
    console.error('Redis test failed:', error)
  }
}

testRedis()
