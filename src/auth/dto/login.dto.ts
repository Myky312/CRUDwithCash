// src/auth/dto/login.dto.ts
export class LoginDto {
  email: string
  password: string

  constructor(email: string, password: string) {
    this.email = email
    this.password = password
  }
}
