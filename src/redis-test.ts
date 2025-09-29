/* eslint-disable no-console */
import { createClient } from 'redis'

async function test() {
  const client = createClient({ url: 'redis://localhost:6379' })
  client.on('error', console.error)
  await client.connect()
  await client.set('test', 'hello')
  console.log(await client.get('test')) // should print "hello"
  await client.disconnect()
}

test()
