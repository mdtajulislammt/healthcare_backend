import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../config/app.config';
import { StripePayment } from '../lib/Payment/stripe/StripePayment';

/**
 * Admin Helper
 * Handles admin user initialization on application startup
 */
export class AdminHelper {
    /**
     * Initialize or update admin user
     * Creates admin user if not exists, updates password if mismatch
     */
    static async initializeAdminUser() {
        const prisma = new PrismaClient();
        try {
            // Get admin credentials from config
            const adminEmail = appConfig().defaultUser.system.email || 'admin@example.com';
            const adminPassword = appConfig().defaultUser.system.password || '12345678';

            // Check if admin user already exists
            const existingAdmin = await prisma.user.findFirst({
                where: {
                    email: adminEmail,
                    type: 'admin',
                },
                include: {
                    role_users: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            if (existingAdmin) {
                console.log('✅ Admin user already exists:', adminEmail);

                // Verify password can be validated with the provided password
                if (existingAdmin.password) {
                    const testPassword = await bcrypt.compare(adminPassword, existingAdmin.password);
                    if (!testPassword) {
                        console.log('⚠️  Admin password mismatch detected. Resetting password...');

                        // Reset password
                        const hashedPassword = await bcrypt.hash(
                            adminPassword,
                            appConfig().security.salt,
                        );

                        await prisma.user.update({
                            where: { id: existingAdmin.id },
                            data: { password: hashedPassword },
                        });

                        // Verify the new password works
                        const verifyUser = await prisma.user.findUnique({
                            where: { id: existingAdmin.id },
                            select: { password: true },
                        });

                        const verifyCompare = await bcrypt.compare(adminPassword, verifyUser.password);
                        if (verifyCompare) {
                            console.log('✅ Admin password reset successfully');
                            console.log(`   Email: ${adminEmail}`);
                            console.log(`   New Password: ${adminPassword}`);
                        } else {
                            console.error('❌ Failed to reset admin password - verification failed');
                        }
                    } else {
                        console.log('   Password is correct, no reset needed.');
                    }
                } else {
                    // No password set, create one
                    console.log('⚠️  Admin user has no password. Setting password...');
                    const hashedPassword = await bcrypt.hash(
                        adminPassword,
                        appConfig().security.salt,
                    );

                    await prisma.user.update({
                        where: { id: existingAdmin.id },
                        data: { password: hashedPassword },
                    });

                    console.log('✅ Admin password set successfully');
                    console.log(`   Email: ${adminEmail}`);
                    console.log(`   Password: ${adminPassword}`);
                }
                return;
            }

            // Check if admin role exists, create if not
            let adminRole = await prisma.role.findFirst({
                where: { name: 'admin' },
            });

            if (!adminRole) {
                adminRole = await prisma.role.create({
                    data: {
                        name: 'admin',
                        title: 'Administrator',
                        status: 1,
                    },
                });
            }

            // Create admin user
            const hashedPassword = await bcrypt.hash(
                adminPassword,
                appConfig().security.salt,
            );

            const adminUser = await prisma.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    type: 'admin',
                    onboarding_step: 'completed',
                    email_verified_at: new Date(),
                    approved_at: new Date(),
                    status: 1,
                },
            });

            // Assign admin role to user
            await prisma.roleUser.create({
                data: {
                    user_id: adminUser.id,
                    role_id: adminRole.id,
                },
            });

            // Create Stripe customer after transaction succeeds (external API)
            try {
                const stripeCustomer = await StripePayment.createCustomer({
                    user_id: adminUser.id,
                    email: adminEmail,
                    name: 'Admin User',
                });

                if (stripeCustomer && stripeCustomer.id) {
                    await prisma.user.update({
                        where: {
                            id: adminUser.id,
                        },
                        data: {
                            billing_id: stripeCustomer.id,
                        },
                    });
                    console.log('✅ Stripe customer created for admin user');
                }
            } catch (stripeError) {
                console.error('❌ Error creating Stripe customer for admin user:', stripeError.message);
            }

            console.log('✅ Admin user created successfully');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Password: ${adminPassword}`);
            console.log('   Please change the password after first login!');
        } catch (error) {
            console.error('❌ Error initializing admin user:', error.message);
        } finally {
            await prisma.$disconnect();
        }
    }
}

