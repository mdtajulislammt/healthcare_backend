import { Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from './message.gateway';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { Role } from 'src/common/guard/role/role.enum';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) { }

  async create(user_id: string, createMessageDto: CreateMessageDto) {
    try {
      const data: any = {};

      if (createMessageDto.conversation_id) {
        data.conversation_id = createMessageDto.conversation_id;
      }

      if (createMessageDto.receiver_id) {
        data.receiver_id = createMessageDto.receiver_id;
      }

      if (createMessageDto.message) {
        data.message = createMessageDto.message;
      }

      // check if conversation exists
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: data.conversation_id,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // check if receiver exists
      const receiver = await this.prisma.user.findFirst({
        where: {
          id: data.receiver_id,
        },
      });

      if (!receiver) {
        return {
          success: false,
          message: 'Receiver not found',
        };
      }

      const message = await this.prisma.message.create({
        data: {
          ...data,
          status: MessageStatus.SENT,
          sender_id: user_id,
        },
      });

      // update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: data.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      // this.messageGateway.server
      //   .to(this.messageGateway.clients.get(data.receiver_id))
      //   .emit('message', { from: data.receiver_id, data: message });

      return {
        success: true,
        data: message,
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    user_id,
    conversation_id,
    limit = 20,
    cursor,
  }: {
    user_id: string;
    conversation_id: string;
    limit?: number;
    cursor?: string;
  }) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const where_condition = {
        AND: [{ id: conversation_id }],
      };

      if (userDetails.type != Role.ADMIN) {
        where_condition['OR'] = [
          { creator_id: user_id },
          { participant_id: user_id },
        ];
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...where_condition,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      const paginationData = {};
      if (limit) {
        paginationData['take'] = limit;
      }
      if (cursor) {
        paginationData['cursor'] = cursor ? { id: cursor } : undefined;
      }

      const messages = await this.prisma.message.findMany({
        ...paginationData,
        where: {
          conversation_id: conversation_id,
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id: true,
          message: true,
          created_at: true,
          status: true,
          sender: {
            select: {
              id: true,
              email: true,
              type: true,
              staff_profile: {
                select: {
                  first_name: true,
                  last_name: true,
                  photo_url: true,
                },
              },
              service_provider_info: {
                select: {
                  organization_name: true,
                  brand_logo_url: true,
                },
              },
            },
          },
          receiver: {
            select: {
              id: true,
              email: true,
              type: true,
              staff_profile: {
                select: {
                  first_name: true,
                  last_name: true,
                  photo_url: true,
                },
              },
              service_provider_info: {
                select: {
                  organization_name: true,
                  brand_logo_url: true,
                },
              },
            },
          },
          attachment: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // Format messages with consistent format
      for (const message of messages) {
        // Format attachment URL
        if (message.attachment) {
          (message.attachment as any).file_url = SojebStorage.url(
            appConfig().storageUrl.attachment + message.attachment.file,
          );
        }

        // Format sender
        if (message.sender) {
          let senderName = null;
          let senderAvatar = null;

          if (message.sender.type === 'staff' && message.sender.staff_profile) {
            senderName = `${message.sender.staff_profile.first_name} ${message.sender.staff_profile.last_name}`;
            if (message.sender.staff_profile.photo_url) {
              senderAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + message.sender.staff_profile.photo_url,
              );
            }
          } else if (message.sender.type === 'service_provider' && message.sender.service_provider_info) {
            senderName = message.sender.service_provider_info.organization_name;
            if (message.sender.service_provider_info.brand_logo_url) {
              senderAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + message.sender.service_provider_info.brand_logo_url,
              );
            }
          } else if (message.sender.type === 'admin') {
            senderName = message.sender.email || 'Admin';
          }

          (message as any).sender = {
            id: message.sender.id,
            email: message.sender.email,
            type: message.sender.type,
            name: senderName,
            avatar_url: senderAvatar,
          };
        }

        // Format receiver
        if (message.receiver) {
          let receiverName = null;
          let receiverAvatar = null;

          if (message.receiver.type === 'staff' && message.receiver.staff_profile) {
            receiverName = `${message.receiver.staff_profile.first_name} ${message.receiver.staff_profile.last_name}`;
            if (message.receiver.staff_profile.photo_url) {
              receiverAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + message.receiver.staff_profile.photo_url,
              );
            }
          } else if (message.receiver.type === 'service_provider' && message.receiver.service_provider_info) {
            receiverName = message.receiver.service_provider_info.organization_name;
            if (message.receiver.service_provider_info.brand_logo_url) {
              receiverAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + message.receiver.service_provider_info.brand_logo_url,
              );
            }
          } else if (message.receiver.type === 'admin') {
            receiverName = message.receiver.email || 'Admin';
          }

          (message as any).receiver = {
            id: message.receiver.id,
            email: message.receiver.email,
            type: message.receiver.type,
            name: receiverName,
            avatar_url: receiverAvatar,
          };
        }
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateMessageStatus(message_id: string, status: MessageStatus) {
    return await ChatRepository.updateMessageStatus(message_id, status);
  }

  async readMessage(message_id: string) {
    return await ChatRepository.updateMessageStatus(
      message_id,
      MessageStatus.READ,
    );
  }

  async updateUserStatus(user_id: string, status: string) {
    return await ChatRepository.updateUserStatus(user_id, status);
  }
}
