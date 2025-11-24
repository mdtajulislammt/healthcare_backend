import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from '../message/message.gateway';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) { }

  async create(createConversationDto: CreateConversationDto) {
    try {
      const data: any = {};

      if (createConversationDto.creator_id) {
        data.creator_id = createConversationDto.creator_id;
      }
      if (createConversationDto.participant_id) {
        data.participant_id = createConversationDto.participant_id;
      }

      // check if conversation exists
      let conversation = await this.prisma.conversation.findFirst({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
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
          participant: {
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
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        where: {
          creator_id: data.creator_id,
          participant_id: data.participant_id,
        },
      });

      if (conversation) {
        // Format existing conversation
        if (conversation.creator) {
          let creatorName = null;
          let creatorAvatar = null;

          if (conversation.creator.type === 'staff' && conversation.creator.staff_profile) {
            creatorName = `${conversation.creator.staff_profile.first_name} ${conversation.creator.staff_profile.last_name}`;
            if (conversation.creator.staff_profile.photo_url) {
              creatorAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + conversation.creator.staff_profile.photo_url,
              );
            }
          } else if (conversation.creator.type === 'service_provider' && conversation.creator.service_provider_info) {
            creatorName = conversation.creator.service_provider_info.organization_name;
            if (conversation.creator.service_provider_info.brand_logo_url) {
              creatorAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + conversation.creator.service_provider_info.brand_logo_url,
              );
            }
          } else if (conversation.creator.type === 'admin') {
            creatorName = conversation.creator.email || 'Admin';
          }

          (conversation as any).creator = {
            id: conversation.creator.id,
            email: conversation.creator.email,
            type: conversation.creator.type,
            name: creatorName,
            avatar_url: creatorAvatar,
          };
        }

        if (conversation.participant) {
          let participantName = null;
          let participantAvatar = null;

          if (conversation.participant.type === 'staff' && conversation.participant.staff_profile) {
            participantName = `${conversation.participant.staff_profile.first_name} ${conversation.participant.staff_profile.last_name}`;
            if (conversation.participant.staff_profile.photo_url) {
              participantAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + conversation.participant.staff_profile.photo_url,
              );
            }
          } else if (conversation.participant.type === 'service_provider' && conversation.participant.service_provider_info) {
            participantName = conversation.participant.service_provider_info.organization_name;
            if (conversation.participant.service_provider_info.brand_logo_url) {
              participantAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + conversation.participant.service_provider_info.brand_logo_url,
              );
            }
          } else if (conversation.participant.type === 'admin') {
            participantName = conversation.participant.email || 'Admin';
          }

          (conversation as any).participant = {
            id: conversation.participant.id,
            email: conversation.participant.email,
            type: conversation.participant.type,
            name: participantName,
            avatar_url: participantAvatar,
          };
        }

        return {
          success: false,
          message: 'Conversation already exists',
          data: conversation,
        };
      }

      conversation = await this.prisma.conversation.create({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
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
          participant: {
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
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        data: {
          ...data,
        },
      });

      // Format creator and participant with consistent format
      if (conversation.creator) {
        let creatorName = null;
        let creatorAvatar = null;

        if (conversation.creator.type === 'staff' && conversation.creator.staff_profile) {
          creatorName = `${conversation.creator.staff_profile.first_name} ${conversation.creator.staff_profile.last_name}`;
          if (conversation.creator.staff_profile.photo_url) {
            creatorAvatar = SojebStorage.url(
              appConfig().storageUrl.staff + conversation.creator.staff_profile.photo_url,
            );
          }
        } else if (conversation.creator.type === 'service_provider' && conversation.creator.service_provider_info) {
          creatorName = conversation.creator.service_provider_info.organization_name;
          if (conversation.creator.service_provider_info.brand_logo_url) {
            creatorAvatar = SojebStorage.url(
              appConfig().storageUrl.brand + conversation.creator.service_provider_info.brand_logo_url,
            );
          }
        } else if (conversation.creator.type === 'admin') {
          creatorName = conversation.creator.email || 'Admin';
        }

        (conversation as any).creator = {
          id: conversation.creator.id,
          email: conversation.creator.email,
          type: conversation.creator.type,
          name: creatorName,
          avatar_url: creatorAvatar,
        };
      }

      if (conversation.participant) {
        let participantName = null;
        let participantAvatar = null;

        if (conversation.participant.type === 'staff' && conversation.participant.staff_profile) {
          participantName = `${conversation.participant.staff_profile.first_name} ${conversation.participant.staff_profile.last_name}`;
          if (conversation.participant.staff_profile.photo_url) {
            participantAvatar = SojebStorage.url(
              appConfig().storageUrl.staff + conversation.participant.staff_profile.photo_url,
            );
          }
        } else if (conversation.participant.type === 'service_provider' && conversation.participant.service_provider_info) {
          participantName = conversation.participant.service_provider_info.organization_name;
          if (conversation.participant.service_provider_info.brand_logo_url) {
            participantAvatar = SojebStorage.url(
              appConfig().storageUrl.brand + conversation.participant.service_provider_info.brand_logo_url,
            );
          }
        } else if (conversation.participant.type === 'admin') {
          participantName = conversation.participant.email || 'Admin';
        }

        (conversation as any).participant = {
          id: conversation.participant.id,
          email: conversation.participant.email,
          type: conversation.participant.type,
          name: participantName,
          avatar_url: participantAvatar,
        };
      }

      // trigger socket event
      this.messageGateway.server.to(data.creator_id).emit('conversation', {
        from: data.creator_id,
        data: conversation,
      });
      this.messageGateway.server.to(data.participant_id).emit('conversation', {
        from: data.participant_id,
        data: conversation,
      });

      return {
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll() {
    try {
      const conversations = await this.prisma.conversation.findMany({
        orderBy: {
          updated_at: 'desc',
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
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
          participant: {
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
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
      });

      // Format creator and participant with consistent format
      for (const conversation of conversations) {
        if (conversation.creator) {
          let creatorName = null;
          let creatorAvatar = null;

          if (conversation.creator.type === 'staff' && conversation.creator.staff_profile) {
            creatorName = `${conversation.creator.staff_profile.first_name} ${conversation.creator.staff_profile.last_name}`;
            if (conversation.creator.staff_profile.photo_url) {
              creatorAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + conversation.creator.staff_profile.photo_url,
              );
            }
          } else if (conversation.creator.type === 'service_provider' && conversation.creator.service_provider_info) {
            creatorName = conversation.creator.service_provider_info.organization_name;
            if (conversation.creator.service_provider_info.brand_logo_url) {
              creatorAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + conversation.creator.service_provider_info.brand_logo_url,
              );
            }
          } else if (conversation.creator.type === 'admin') {
            creatorName = conversation.creator.email || 'Admin';
          }

          (conversation as any).creator = {
            id: conversation.creator.id,
            email: conversation.creator.email,
            type: conversation.creator.type,
            name: creatorName,
            avatar_url: creatorAvatar,
          };
        }

        if (conversation.participant) {
          let participantName = null;
          let participantAvatar = null;

          if (conversation.participant.type === 'staff' && conversation.participant.staff_profile) {
            participantName = `${conversation.participant.staff_profile.first_name} ${conversation.participant.staff_profile.last_name}`;
            if (conversation.participant.staff_profile.photo_url) {
              participantAvatar = SojebStorage.url(
                appConfig().storageUrl.staff + conversation.participant.staff_profile.photo_url,
              );
            }
          } else if (conversation.participant.type === 'service_provider' && conversation.participant.service_provider_info) {
            participantName = conversation.participant.service_provider_info.organization_name;
            if (conversation.participant.service_provider_info.brand_logo_url) {
              participantAvatar = SojebStorage.url(
                appConfig().storageUrl.brand + conversation.participant.service_provider_info.brand_logo_url,
              );
            }
          } else if (conversation.participant.type === 'admin') {
            participantName = conversation.participant.email || 'Admin';
          }

          (conversation as any).participant = {
            id: conversation.participant.id,
            email: conversation.participant.email,
            type: conversation.participant.type,
            name: participantName,
            avatar_url: participantAvatar,
          };
        }
      }

      return {
        success: true,
        data: conversations,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
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
          participant: {
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
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // Format creator and participant with consistent format
      if (conversation.creator) {
        let creatorName = null;
        let creatorAvatar = null;

        if (conversation.creator.type === 'staff' && conversation.creator.staff_profile) {
          creatorName = `${conversation.creator.staff_profile.first_name} ${conversation.creator.staff_profile.last_name}`;
          if (conversation.creator.staff_profile.photo_url) {
            creatorAvatar = SojebStorage.url(
              appConfig().storageUrl.staff + conversation.creator.staff_profile.photo_url,
            );
          }
        } else if (conversation.creator.type === 'service_provider' && conversation.creator.service_provider_info) {
          creatorName = conversation.creator.service_provider_info.organization_name;
          if (conversation.creator.service_provider_info.brand_logo_url) {
            creatorAvatar = SojebStorage.url(
              appConfig().storageUrl.brand + conversation.creator.service_provider_info.brand_logo_url,
            );
          }
        } else if (conversation.creator.type === 'admin') {
          creatorName = conversation.creator.email || 'Admin';
        }

        (conversation as any).creator = {
          id: conversation.creator.id,
          email: conversation.creator.email,
          type: conversation.creator.type,
          name: creatorName,
          avatar_url: creatorAvatar,
        };
      }

      if (conversation.participant) {
        let participantName = null;
        let participantAvatar = null;

        if (conversation.participant.type === 'staff' && conversation.participant.staff_profile) {
          participantName = `${conversation.participant.staff_profile.first_name} ${conversation.participant.staff_profile.last_name}`;
          if (conversation.participant.staff_profile.photo_url) {
            participantAvatar = SojebStorage.url(
              appConfig().storageUrl.staff + conversation.participant.staff_profile.photo_url,
            );
          }
        } else if (conversation.participant.type === 'service_provider' && conversation.participant.service_provider_info) {
          participantName = conversation.participant.service_provider_info.organization_name;
          if (conversation.participant.service_provider_info.brand_logo_url) {
            participantAvatar = SojebStorage.url(
              appConfig().storageUrl.brand + conversation.participant.service_provider_info.brand_logo_url,
            );
          }
        } else if (conversation.participant.type === 'admin') {
          participantName = conversation.participant.email || 'Admin';
        }

        (conversation as any).participant = {
          id: conversation.participant.id,
          email: conversation.participant.email,
          type: conversation.participant.type,
          name: participantName,
          avatar_url: participantAvatar,
        };
      }

      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    try {
      const data = {};
      if (updateConversationDto.creator_id) {
        data['creator_id'] = updateConversationDto.creator_id;
      }
      if (updateConversationDto.participant_id) {
        data['participant_id'] = updateConversationDto.participant_id;
      }

      await this.prisma.conversation.update({
        where: { id },
        data: {
          ...data,
          updated_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Conversation updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.conversation.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
