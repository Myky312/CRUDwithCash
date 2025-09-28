import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { getTypeOrmConfig } from './src/typeorm.config'
import 'dotenv/config'
import 'reflect-metadata'

const configService = new ConfigService()
export const AppDataSource = new DataSource(getTypeOrmConfig(configService))
