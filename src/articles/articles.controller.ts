import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { ArticlesService } from './articles.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateArticleDto, @Req() req: Request & { user: any }) {
    return this.articlesService.create(dto, req.user)
  }

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('authorId') authorId?: number,
    @Query('publishedAfter') publishedAfter?: string,
    @Query('publishedBefore') publishedBefore?: string,
  ) {
    return this.articlesService.findAll(Number(page), Number(limit), { authorId, publishedAfter, publishedBefore })
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.articlesService.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.articlesService.remove(id)
  }
}
