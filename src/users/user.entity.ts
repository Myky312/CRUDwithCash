import * as bcrypt from 'bcrypt'
// src/users/user.entity.ts
import { BeforeInsert, Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Article } from '../articles/articles.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  email: string

  @Column({ length: 255 })
  password: string

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10)
  }

  @OneToMany(() => Article, article => article.author)
  articles: Article[]
}
