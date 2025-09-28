// src/auth/dto/register.dto.ts
export class RegisterDto {
  email: string
  password: string

  constructor(email: string, password: string) {
    this.email = email
    this.password = password
  }
}
