import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface ServiceProviderContext {
    serviceProviderId: string;
    employeeId?: string | null;
}

@Injectable()
export class ServiceProviderContextHelper {
    constructor(private readonly prisma: PrismaService) { }

    async resolveFromUser(userId: string): Promise<ServiceProviderContext> {
        const provider = await this.prisma.serviceProviderInfo.findFirst({
            where: { user_id: userId },
            select: { id: true },
        });

        if (provider) {
            return { serviceProviderId: provider.id, employeeId: null };
        }

        const employee = await this.prisma.employee.findFirst({
            where: { user_id: userId },
            select: { id: true, service_provider_id: true },
        });

        if (employee?.service_provider_id) {
            return {
                serviceProviderId: employee.service_provider_id,
                employeeId: employee.id,
            };
        }

        throw new ForbiddenException('Service provider profile not found.');
    }
}

