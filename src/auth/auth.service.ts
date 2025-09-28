/* eslint-disable no-console */
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'

import { User } from '../users/user.entity'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } })
    if (existing)
      throw new ConflictException('User already exists')

    const user = this.usersRepo.create({ email: dto.email, password: dto.password.trim() })
    await this.usersRepo.save(user)

    return { message: 'User registered successfully' }
  }

  async login(dto: LoginDto) {
    console.log('Login attempt:', dto)
    const user = await this.usersRepo.findOne({ where: { email: dto.email } })
    if (!user)
      throw new UnauthorizedException('Invalid credentials')

    const match = await bcrypt.compare(dto.password, user.password)
    console.log('Password match:', match)
    if (!match)
      throw new UnauthorizedException('Invalid credentials')

    const payload = { sub: user.id, email: user.email }
    const token = await this.jwtService.signAsync(payload)
    console.log('JWT token:', token)

    return { access_token: token }
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id: userId } })
  }
}
