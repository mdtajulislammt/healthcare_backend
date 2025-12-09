import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { XeroClient } from 'xero-node';
import appConfig from '../../../config/app.config';
import { TimesheetStatus } from '@prisma/client';

@Injectable()
export class XeroService {
    private readonly logger = new Logger(XeroService.name);
    private xeroClient: XeroClient;

    constructor(private readonly prisma: PrismaService) {
        const config = appConfig().payment.xero;
        this.xeroClient = new XeroClient({
            clientId: config.clientId || '',
            clientSecret: config.clientSecret || '',
            redirectUris: config.redirectUri ? [config.redirectUri] : [],
            scopes: [
                'accounting.transactions',
                'accounting.contacts',
                'accounting.settings',
                'offline_access', // Required to get refresh token
            ],
        });
    }

    /**
     * Check if Xero is connected
     */
    async isConnected(): Promise<boolean> {
        try {
            const xeroAuth = await this.prisma.xeroAuth.findFirst();
            if (!xeroAuth) return false;

            // Check if token is still valid (with buffer)
            const now = new Date();
            const expiresAt = new Date(xeroAuth.expires_at);
            const buffer = 5 * 60 * 1000; // 5 minutes

            return now.getTime() + buffer < expiresAt.getTime();
        } catch {
            return false;
        }
    }

    /**
     * Get Xero OAuth authorization URL
     */
    async getAuthorizationUrl(): Promise<string> {
        try {
            const consentUrl = await this.xeroClient.buildConsentUrl();
            return consentUrl;
        } catch (error) {
            this.logger.error('Failed to build Xero consent URL', error);
            throw new InternalServerErrorException(
                'Failed to generate Xero authorization URL',
            );
        }
    }

    /**
     * Handle OAuth callback and store tokens
     */
    async handleOAuthCallback(code: string): Promise<void> {
        try {
            // Build the full callback URL with the code
            const config = appConfig().payment.xero;
            const callbackUrl = `${config.redirectUri}?code=${code}`;

            this.logger.log('Processing Xero OAuth callback', {
                hasCode: !!code,
                callbackUrl: callbackUrl.substring(0, 50) + '...',
            });

            // Exchange authorization code for tokens
            // apiCallback expects the full callback URL and sets token internally
            const tokenSet = await this.xeroClient.apiCallback(callbackUrl);

            // Validate token set
            if (!tokenSet) {
                this.logger.error('No token set received from Xero');
                throw new BadRequestException(
                    'Failed to obtain token set from Xero',
                );
            }

            // Check if access_token exists (it might be in different property)
            const accessToken =
                tokenSet.access_token ||
                (tokenSet as any).accessToken ||
                (tokenSet as any).access_token;

            if (!accessToken) {
                this.logger.error('Invalid token set - no access token', {
                    tokenSetKeys: Object.keys(tokenSet),
                    tokenSetType: typeof tokenSet,
                });
                throw new BadRequestException(
                    'Failed to obtain access token from Xero',
                );
            }

            // Log token set for debugging (without sensitive data)
            // Check all possible refresh token locations
            const possibleRefreshToken =
                tokenSet.refresh_token ||
                (tokenSet as any).refreshToken ||
                (tokenSet as any).refresh_token;
            
            // Log full tokenSet structure (without sensitive values)
            const tokenSetInfo: any = {
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!possibleRefreshToken,
                expiresAt: tokenSet.expires_at || (tokenSet as any).expiresAt,
                tokenSetType: typeof tokenSet,
                tokenSetKeys: Object.keys(tokenSet),
            };
            
            // Check if refresh_token exists in any form
            if (tokenSet.refresh_token) {
                tokenSetInfo.refreshTokenSource = 'refresh_token';
            } else if ((tokenSet as any).refreshToken) {
                tokenSetInfo.refreshTokenSource = 'refreshToken';
            } else {
                tokenSetInfo.refreshTokenSource = 'not found';
                // Log the actual tokenSet structure for debugging
                tokenSetInfo.tokenSetSample = JSON.stringify(tokenSet).substring(0, 200);
            }
            
            this.logger.log('Token set received from Xero', tokenSetInfo);

            // Ensure token is set on client (apiCallback should do this, but let's be explicit)
            this.xeroClient.setTokenSet(tokenSet);

            // Verify token is set
            const readTokenSet = this.xeroClient.readTokenSet();
            if (!readTokenSet || !readTokenSet.access_token) {
                this.logger.error('Token not properly set on client', {
                    hasReadTokenSet: !!readTokenSet,
                });
                throw new BadRequestException(
                    'Failed to set token on Xero client',
                );
            }

            // Get tenants (this requires a valid access token)
            let tenants;
            try {
                tenants = await this.xeroClient.updateTenants();
            } catch (tenantError) {
                this.logger.error('Failed to update tenants', {
                    error: tenantError.message,
                    errorStack: tenantError.stack,
                });
                throw new BadRequestException(
                    `Failed to get Xero tenants: ${tenantError.message}`,
                );
            }

            if (!tenants || tenants.length === 0) {
                throw new BadRequestException('No Xero tenants found');
            }

            const tenant = tenants[0];

            // Get refresh token - check multiple possible locations
            const refreshToken =
                tokenSet.refresh_token ||
                (tokenSet as any).refreshToken ||
                (tokenSet as any).refresh_token ||
                '';

            this.logger.log('Token details', {
                hasRefreshToken: !!refreshToken,
                refreshTokenLength: refreshToken ? refreshToken.length : 0,
                tokenSetKeys: Object.keys(tokenSet),
            });

            // Calculate expiration time
            const expiresAtValue =
                tokenSet.expires_at || (tokenSet as any).expiresAt;
            const expiresAt = expiresAtValue
                ? new Date(expiresAtValue * 1000)
                : new Date(Date.now() + 3600000); // Default 1 hour if not provided

            // Store or update XeroAuth record
            const existingAuth = await this.prisma.xeroAuth.findUnique({
                where: { tenant_id: tenant.tenantId },
            });

            if (existingAuth) {
                // Update existing record - keep existing refresh token if new one not provided
                await this.prisma.xeroAuth.update({
                    where: { tenant_id: tenant.tenantId },
                    data: {
                        access_token: accessToken,
                        refresh_token: refreshToken || existingAuth.refresh_token,
                        expires_at: expiresAt,
                    },
                });
                this.logger.log('Updated existing Xero auth record');
            } else {
                // Create new record
                // Note: Xero should provide refresh token, but if not, we'll use empty string
                // The refresh token will be obtained on next token refresh
                if (!refreshToken) {
                    this.logger.warn(
                        'No refresh token received from Xero on initial connection. This may cause issues with token refresh.',
                    );
                    // Allow connection to proceed - refresh token might be obtained later
                }
                await this.prisma.xeroAuth.create({
                    data: {
                        tenant_id: tenant.tenantId,
                        access_token: accessToken,
                        refresh_token: refreshToken || '', // Use empty string if not provided
                        expires_at: expiresAt,
                    },
                });
                this.logger.log('Created new Xero auth record', {
                    hasRefreshToken: !!refreshToken,
                });
            }

            this.logger.log(
                `Xero OAuth completed for tenant: ${tenant.tenantId}`,
            );
        } catch (error) {
            this.logger.error('Failed to handle Xero OAuth callback', {
                error: error.message,
                stack: error.stack,
            });

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException(
                `Failed to complete Xero authorization: ${error.message}`,
            );
        }
    }

    /**
     * Get valid access token (refresh if needed)
     */
    private async getValidAccessToken(): Promise<string> {
        const xeroAuth = await this.prisma.xeroAuth.findFirst();

        if (!xeroAuth) {
            throw new BadRequestException(
                'Xero not connected. Please connect Xero first.',
            );
        }

        // Check if token is expired (with 5 minute buffer)
        const now = new Date();
        const expiresAt = new Date(xeroAuth.expires_at);
        const buffer = 5 * 60 * 1000; // 5 minutes

        if (now.getTime() + buffer >= expiresAt.getTime()) {
            // Token expired or about to expire, refresh it
            await this.refreshAccessToken(xeroAuth);
            const updated = await this.prisma.xeroAuth.findUnique({
                where: { id: xeroAuth.id },
            });
            return updated!.access_token;
        }

        return xeroAuth.access_token;
    }

    /**
     * Refresh access token
     */
    private async refreshAccessToken(xeroAuth: any): Promise<void> {
        try {
            // Check if refresh token exists
            if (!xeroAuth.refresh_token || xeroAuth.refresh_token.trim() === '') {
                throw new BadRequestException(
                    'No refresh token available. Please reconnect Xero to get a refresh token.',
                );
            }

            this.xeroClient.setTokenSet({
                access_token: xeroAuth.access_token,
                refresh_token: xeroAuth.refresh_token,
            });

            const tokenSet = await this.xeroClient.refreshToken();

            await this.prisma.xeroAuth.update({
                where: { id: xeroAuth.id },
                data: {
                    access_token: tokenSet.access_token || '',
                    refresh_token: tokenSet.refresh_token || xeroAuth.refresh_token,
                    expires_at: tokenSet.expires_at
                        ? new Date(tokenSet.expires_at * 1000)
                        : new Date(Date.now() + 3600000),
                },
            });

            this.logger.log('Xero access token refreshed');
        } catch (error) {
            this.logger.error('Failed to refresh Xero token', error);
            throw new InternalServerErrorException(
                'Failed to refresh Xero access token',
            );
        }
    }

    /**
     * Sync or create Xero contact for Service Provider
     */
    async syncContactForServiceProvider(
        serviceProviderId: string,
    ): Promise<string> {
        try {
            const serviceProvider =
                await this.prisma.serviceProviderInfo.findUnique({
                    where: { id: serviceProviderId },
                    include: {
                        user: {
                            select: {
                                email: true,
                            },
                        },
                    },
                });

            if (!serviceProvider) {
                throw new BadRequestException('Service provider not found');
            }

            // If already has Xero contact ID, return it
            if (serviceProvider.xero_contact_id) {
                return serviceProvider.xero_contact_id;
            }

            const accessToken = await this.getValidAccessToken();
            this.xeroClient.setTokenSet({ access_token: accessToken });

            const tenantId = (
                await this.prisma.xeroAuth.findFirst()
            )?.tenant_id;

            if (!tenantId) {
                throw new BadRequestException('Xero tenant not found');
            }

            // Create contact in Xero
            const contactsResponse = await this.xeroClient.accountingApi.createContacts(
                tenantId,
                {
                    contacts: [
                        {
                            name: serviceProvider.organization_name,
                            emailAddress: serviceProvider.user?.email || undefined,
                            addresses: [
                                {
                                    addressType: 'STREET' as any,
                                    addressLine1: serviceProvider.primary_address,
                                },
                            ],
                            phones: serviceProvider.mobile_number
                                ? [
                                      {
                                          phoneType: 'MOBILE' as any,
                                          phoneNumber: `${serviceProvider.mobile_code || ''}${serviceProvider.mobile_number}`,
                                      },
                                  ]
                                : undefined,
                        },
                    ],
                },
            );

            const contact = contactsResponse.body.contacts?.[0];
            if (!contact || !contact.contactID) {
                throw new InternalServerErrorException(
                    'Failed to create Xero contact',
                );
            }

            // Save Xero contact ID
            await this.prisma.serviceProviderInfo.update({
                where: { id: serviceProviderId },
                data: { xero_contact_id: contact.contactID },
            });

            this.logger.log(
                `Xero contact created/updated for service provider: ${serviceProviderId}`,
            );

            return contact.contactID;
        } catch (error) {
            this.logger.error(
                'Failed to sync Xero contact for service provider',
                error,
            );
            throw new InternalServerErrorException(
                'Failed to sync Xero contact',
            );
        }
    }

    /**
     * Create Xero invoice for approved timesheet
     */
    async createInvoiceForTimesheet(timesheetId: string): Promise<{
        invoiceId: string;
        invoiceNumber: string;
    }> {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { id: timesheetId },
                include: {
                    shift: {
                        include: {
                            service_provider_info: {
                                include: {
                                    user: {
                                        select: {
                                            email: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    staff: {
                        select: {
                            first_name: true,
                            last_name: true,
                            bank_details: true,
                        },
                    },
                },
            });

            if (!timesheet) {
                throw new BadRequestException('Timesheet not found');
            }

            if (timesheet.status !== TimesheetStatus.approved) {
                throw new BadRequestException(
                    'Only approved timesheets can be invoiced',
                );
            }

            if (timesheet.xero_invoice_id) {
                // Invoice already created, return existing
                return {
                    invoiceId: timesheet.xero_invoice_id,
                    invoiceNumber: timesheet.xero_invoice_number || '',
                };
            }

            if (!timesheet.total_pay || !timesheet.total_hours) {
                throw new BadRequestException(
                    'Timesheet must have total_pay and total_hours calculated',
                );
            }

            const serviceProvider = timesheet.shift.service_provider_info;
            if (!serviceProvider) {
                throw new BadRequestException(
                    'Service provider not found for this shift',
                );
            }

            // Ensure Xero contact exists
            const xeroContactId = await this.syncContactForServiceProvider(
                serviceProvider.id,
            );

            const accessToken = await this.getValidAccessToken();
            this.xeroClient.setTokenSet({ access_token: accessToken });

            const tenantId = (
                await this.prisma.xeroAuth.findFirst()
            )?.tenant_id;

            if (!tenantId) {
                throw new BadRequestException('Xero tenant not found');
            }

            // Build invoice description
            const shift = timesheet.shift;
            const staffName = `${timesheet.staff.first_name} ${timesheet.staff.last_name}`;
            const invoiceDate = new Date();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

            const description = `${shift.posting_title} - ${staffName} (${timesheet.total_hours}h @ £${timesheet.hourly_rate}/hr)`;

            // Build staff payment details for manual payment
            const bankDetails = timesheet.staff.bank_details;
            let staffPaymentNotes = `Staff Payment Details:\nStaff Name: ${staffName}\nAmount Due to Staff: £${timesheet.total_pay?.toFixed(2) || '0.00'}`;
            
            if (bankDetails) {
                staffPaymentNotes += `\nAccount Holder: ${bankDetails.account_holder_name}`;
                staffPaymentNotes += `\nSort Code: ${bankDetails.sort_code}`;
                staffPaymentNotes += `\nAccount Number: ${bankDetails.account_number}`;
                if (bankDetails.bank_name) {
                    staffPaymentNotes += `\nBank: ${bankDetails.bank_name}`;
                }
            } else {
                staffPaymentNotes += `\n\nNote: Staff bank details not provided.`;
            }

            // Create invoice in Xero
            const invoiceResponse = await this.xeroClient.accountingApi.createInvoices(
                tenantId,
                {
                    invoices: [
                        {
                            type: 'ACCREC' as any, // Accounts Receivable
                            contact: {
                                contactID: xeroContactId,
                            },
                            date: invoiceDate.toISOString().split('T')[0],
                            dueDate: dueDate.toISOString().split('T')[0],
                            lineItems: [
                                {
                                    description: description,
                                    quantity: timesheet.total_hours,
                                    unitAmount: timesheet.hourly_rate,
                                    accountCode: '200', // Default revenue account (client should configure)
                                    taxType: 'NONE', // Can be configured later
                                },
                            ],
                            reference: `TS-${timesheetId.substring(0, 8)}`,
                            status: 'AUTHORISED' as any,
                            currencyCode: 'GBP' as any,
                            // Staff bank details for manual payment (appears at bottom of invoice)
                            notes: staffPaymentNotes,
                        } as any,
                    ],
                },
            );

            const invoice = invoiceResponse.body.invoices?.[0];
            if (!invoice || !invoice.invoiceID) {
                throw new InternalServerErrorException(
                    'Failed to create Xero invoice',
                );
            }

            // Update timesheet with Xero invoice info
            await this.prisma.shiftTimesheet.update({
                where: { id: timesheetId },
                data: {
                    xero_invoice_id: invoice.invoiceID,
                    xero_invoice_number: invoice.invoiceNumber || null,
                    xero_status: invoice.status ? String(invoice.status) : null,
                },
            });

            // Create PaymentTransaction record
            await this.prisma.paymentTransaction.create({
                data: {
                    user_id: serviceProvider.user_id,
                    type: 'xero_invoice',
                    reference_number: invoice.invoiceID || '',
                    order_id: timesheetId,
                    amount: timesheet.total_pay,
                    currency: 'GBP',
                    status: 'pending',
                    raw_status: invoice.status ? String(invoice.status) : 'AUTHORISED',
                },
            });

            this.logger.log(
                `Xero invoice created for timesheet ${timesheetId}: ${invoice.invoiceNumber}`,
            );

            return {
                invoiceId: invoice.invoiceID,
                invoiceNumber: invoice.invoiceNumber || '',
            };
        } catch (error) {
            this.logger.error(
                'Failed to create Xero invoice for timesheet',
                error,
            );
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to create Xero invoice',
            );
        }
    }

    /**
     * Update invoice status from Xero
     */
    async updateInvoiceStatusFromXero(invoiceId: string): Promise<void> {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findFirst({
                where: { xero_invoice_id: invoiceId },
            });

            if (!timesheet) {
                this.logger.warn(
                    `Timesheet not found for Xero invoice: ${invoiceId}`,
                );
                return;
            }

            const accessToken = await this.getValidAccessToken();
            this.xeroClient.setTokenSet({ access_token: accessToken });

            const tenantId = (
                await this.prisma.xeroAuth.findFirst()
            )?.tenant_id;

            if (!tenantId) {
                throw new BadRequestException('Xero tenant not found');
            }

            // Get invoice from Xero
            const invoiceResponse = await this.xeroClient.accountingApi.getInvoice(
                tenantId,
                invoiceId,
            );

            const invoice = invoiceResponse.body.invoices?.[0];
            if (!invoice) {
                this.logger.warn(`Invoice not found in Xero: ${invoiceId}`);
                return;
            }

            const xeroStatus = invoice.status ? String(invoice.status) : '';
            const isPaid = xeroStatus === 'PAID' || invoice.amountPaid === invoice.total;

            // Update timesheet
            await this.prisma.shiftTimesheet.update({
                where: { id: timesheet.id },
                data: {
                    xero_status: xeroStatus || null,
                    ...(isPaid && {
                        status: TimesheetStatus.paid,
                        paid_at: new Date(),
                    }),
                },
            });

            // Update PaymentTransaction
            await this.prisma.paymentTransaction.updateMany({
                where: { reference_number: invoiceId },
                data: {
                    status: isPaid ? 'paid' : 'pending',
                    raw_status: xeroStatus || null,
                    paid_amount: invoice.amountPaid || null,
                    paid_currency: 'GBP',
                },
            });

            this.logger.log(
                `Invoice status updated for ${invoiceId}: ${xeroStatus}`,
            );
        } catch (error) {
            this.logger.error(
                'Failed to update invoice status from Xero',
                error,
            );
            throw new InternalServerErrorException(
                'Failed to sync invoice status',
            );
        }
    }
}

