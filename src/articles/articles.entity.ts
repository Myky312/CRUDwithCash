import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from '../users/user.entity'

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  title: string

  @Column({ type: 'text' })
  description: string

  @CreateDateColumn()
  publishedAt: Date

  @ManyToOne(() => User, user => user.articles)
  author: User

  @Column()
  authorId: number
}
