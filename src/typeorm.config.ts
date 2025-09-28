import type { ConfigService } from '@nestjs/config'
import type { DataSourceOptions } from 'typeorm'
import { Article } from './articles/articles.entity'
import { User } from './users/user.entity'

export function getTypeOrmConfig(configService: ConfigService): DataSourceOptions {
  const isCompiled = __dirname.includes('dist') // detect prod build

  return {
    type: 'postgres',
    host: configService.get('DB_HOST') || 'localhost',
    port: Number(configService.get('DB_PORT')) || 5432,
    username: configService.get('POSTGRES_USER') || 'postgres',
    password: configService.get('POSTGRES_PASSWORD') || 'supersecret',
    database: configService.get('POSTGRES_DB') || 'hospitals',
    entities: [User, Article],
    migrations: [
      isCompiled
        ? 'dist/migrations/*.js' // prod: compiled JS
        : 'migrations/*.ts', // dev: TS
    ],
    synchronize: false,
    logging: true,
  }
}
