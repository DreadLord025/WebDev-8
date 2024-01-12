/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseFilters,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Response,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { ITShopService } from './itshop.service'
import { CreateITShopDto } from './dto/create-itshop.dto'
import { UpdateITShopDto } from './dto/update-itshop.dto'
import { itExceptionFilter } from './filter/note-exception/it-exception.filter'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'
import { ClientProxy, EventPattern } from '@nestjs/microservices'
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Controller('itshop')
@UseFilters(new itExceptionFilter())
export class ITShopController {
  @WebSocketServer()
  server: Server
  constructor(
    private readonly ITShopService: ITShopService,
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @EventPattern('model_create')
  async handleModelCreated(data: Record<string, unknown>) {
    console.log('Model has been created successfully', data)
  }

  @EventPattern('model_patched')
  async handleModelPatched(data: Record<string, unknown>) {
    console.log('Model has been patched successfully', data)
  }

  @EventPattern('model_deleted')
  async handleModelDeleted(data: Record<string, unknown>) {
    console.log('Model has been deleted successfully', data)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('create')
  async create(@Body() createITShopDto: CreateITShopDto, @Req() req) {
    if (req.user && !isNaN(req.user.id)) {
      this.client.emit('model_create', createITShopDto)
      const message = await this.ITShopService.create(
        createITShopDto,
        +req.user.id,
      )
      this.server.emit('model_created_message', message)
      return message
    } else {
      throw new BadRequestException('Invalid user ID')
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req) {
    if (req.user && !isNaN(req.user.id)) {
      return this.ITShopService.findAll(+req.user.id)
    } else {
      throw new BadRequestException('Invalid user ID')
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    try {
      if (!isNaN(+id)) {
        const model = await this.ITShopService.findOne(+id)
        return model
      } else {
        throw new BadRequestException('Invalid model ID')
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        console.log('Model not found')
      } else {
        throw error
      }
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateITShopDto: UpdateITShopDto,
    @Response() res,
  ) {
    try {
      if (!isNaN(+id)) {
        this.client.emit('model_patched', updateITShopDto)
        const updatedModel = await this.ITShopService.update(
          +id,
          updateITShopDto,
          res,
        )
        return updatedModel
      } else {
        throw new BadRequestException('Invalid model ID')
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        console.log('Model not found')
      } else {
        throw error
      }
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Response() res) {
    try {
      await this.ITShopService.remove(+id, res)
      this.client.emit('model_deleted', id)
    } catch (error) {
      if (error instanceof NotFoundException) {
        console.log('Model not found')
      } else {
        throw error
      }
    }
  }
  @SubscribeMessage('join')
  joinRoom(
    @MessageBody('name') name: string,
    @ConnectedSocket() client: Socket,
  ) {
    return this.ITShopService.identify(name, client.id)
  }

  @SubscribeMessage('typing')
  async typing(
    @MessageBody('isTyping') isTyping: boolean,
    @ConnectedSocket() client: Socket,
  ) {
    const name = await this.ITShopService.getClientName(client.id)
    client.broadcast.emit('typing', { name, isTyping })
  }
}
