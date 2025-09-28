// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ArticlesModule } from './articles/articles.module'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './database/database.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
  ],
})
export class AppModule {}
