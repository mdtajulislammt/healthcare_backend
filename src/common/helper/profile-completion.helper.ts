/**
 * Profile Completion Helper
 * Calculates profile completion percentage and completion status for staff profiles
 */

interface StaffProfileWithRelations {
    id: string;
    first_name: string;
    last_name: string;
    mobile_code?: string | null;
    mobile_number?: string | null;
    date_of_birth: Date;
    photo_url?: string | null;
    bio?: string | null;
    experience?: string | null;
    roles?: any[];
    right_to_work_status?: string;
    cv_url?: string | null;
    certificates?: Array<{ id: string }>;
    dbs_info?: {
        certificate_number?: string;
        surname_as_certificate?: string;
        date_of_birth_on_cert?: Date;
        certificate_print_date?: Date;
    } | null;
    emergency_contacts?: {
        mobile_code?: string;
        mobile_number?: string;
    } | null;
    current_address?: {
        address?: string;
        evidence_file_url?: string | null;
    } | null;
    previous_address?: {
        address?: string;
    } | null;
    educations?: Array<{ id: string }>;
    bank_details?: {
        account_holder_name?: string;
        sort_code?: string;
        account_number?: string;
    } | null;
}

export interface ProfileCompletionResult {
    profile_completion: number; // 0-100
    is_profile_complete: boolean; // true if >= 95%
}

/**
 * Calculate staff profile completion percentage
 * @param staffProfile - Staff profile with all relations
 * @returns Profile completion result with percentage and completion status
 * 
 * Weights:
 * - Basic Info: 20%
 * - Roles & Work: 15%
 * - Certificates: 25%
 * - DBS Info: 5%
 * - Emergency Contact: 5%
 * - Current Address: 5%
 * - Previous Address: 5%
 * - Education: 10%
 * - Bank Details: 10%
 * - Total: 100%
 */
export function calculateStaffProfileCompletion(
    staffProfile: StaffProfileWithRelations,
): ProfileCompletionResult {
    let totalPercentage = 0;

    // 1. Basic Info (20%) - 8 fields, 2.5% each
    const basicInfoFields = [
        { value: staffProfile.first_name, weight: 2.5 },
        { value: staffProfile.last_name, weight: 2.5 },
        { value: staffProfile.mobile_code, weight: 2.5 },
        { value: staffProfile.mobile_number, weight: 2.5 },
        { value: staffProfile.date_of_birth, weight: 2.5 },
        { value: staffProfile.photo_url, weight: 2.5 },
        { value: staffProfile.bio, weight: 2.5 },
        { value: staffProfile.experience, weight: 2.5 },
    ];

    let basicInfoScore = 0;
    for (const field of basicInfoFields) {
        const hasValue = field.value !== null &&
            field.value !== undefined &&
            (field.value instanceof Date ? true : field.value !== '');
        if (hasValue) {
            basicInfoScore += field.weight;
        }
    }
    totalPercentage += Math.min(basicInfoScore, 20);

    // 2. Roles & Work (15%) - 3 fields, 5% each
    let rolesWorkScore = 0;

    // Roles (5%)
    if (staffProfile.roles && Array.isArray(staffProfile.roles) && staffProfile.roles.length > 0) {
        rolesWorkScore += 5;
    }

    // Right to work status (5%)
    if (staffProfile.right_to_work_status) {
        rolesWorkScore += 5;
    }

    // CV URL (5%)
    if (staffProfile.cv_url) {
        rolesWorkScore += 5;
    }

    totalPercentage += rolesWorkScore;

    // 3. Certificates (25%) - at least 10 certificates = full points
    if (staffProfile.certificates && Array.isArray(staffProfile.certificates)) {
        if (staffProfile.certificates.length >= 10) {
            totalPercentage += 25;
        } else {
            // Partial points: 2.5% per certificate (max 25%)
            totalPercentage += Math.min(staffProfile.certificates.length * 2.5, 25);
        }
    }

    // 4. DBS Info (5%) - all required fields must exist
    if (staffProfile.dbs_info) {
        const dbsFields = [
            staffProfile.dbs_info.certificate_number,
            staffProfile.dbs_info.surname_as_certificate,
            staffProfile.dbs_info.date_of_birth_on_cert,
            staffProfile.dbs_info.certificate_print_date,
        ];

        const filledDbsFields = dbsFields.filter(
            (field) => field !== null && field !== undefined && field !== '',
        ).length;

        if (filledDbsFields === 4) {
            totalPercentage += 5; // All fields filled = full points
        } else if (filledDbsFields > 0) {
            // Partial points: 1.25% per field
            totalPercentage += filledDbsFields * 1.25;
        }
    }

    // 5. Emergency Contact (5%) - mobile_code and mobile_number required
    if (staffProfile.emergency_contacts) {
        const hasMobileCode = !!staffProfile.emergency_contacts.mobile_code;
        const hasMobileNumber = !!staffProfile.emergency_contacts.mobile_number;

        if (hasMobileCode && hasMobileNumber) {
            totalPercentage += 5; // Both required fields = full points
        } else if (hasMobileCode || hasMobileNumber) {
            totalPercentage += 2.5; // Only one field = half points
        }
    }

    // 6. Current Address (5%) - address and evidence_file_url required
    if (staffProfile.current_address) {
        const hasAddress = !!staffProfile.current_address.address;
        const hasEvidence = !!staffProfile.current_address.evidence_file_url;

        if (hasAddress && hasEvidence) {
            totalPercentage += 5; // Both required = full points
        } else if (hasAddress) {
            totalPercentage += 2.5; // Only address = half points
        }
    }

    // 7. Previous Address (5%) - address required
    if (staffProfile.previous_address && staffProfile.previous_address.address) {
        totalPercentage += 5;
    }

    // 8. Education (10%) - at least 1 education = full points
    if (staffProfile.educations && Array.isArray(staffProfile.educations) && staffProfile.educations.length > 0) {
        totalPercentage += 10;
    }

    // 9. Bank Details (10%) - required for staff payment
    if (staffProfile.bank_details) {
        const bankFields = [
            staffProfile.bank_details.account_holder_name,
            staffProfile.bank_details.sort_code,
            staffProfile.bank_details.account_number,
        ];

        const filledBankFields = bankFields.filter(
            (field) => field !== null && field !== undefined && field !== '',
        ).length;

        if (filledBankFields === 3) {
            totalPercentage += 10; // All required fields = full points
        } else if (filledBankFields > 0) {
            // Partial points: ~3.33% per field
            totalPercentage += Math.round((filledBankFields / 3) * 10);
        }
    }

    // Round to nearest integer and ensure it's between 0-100
    const profileCompletion = Math.round(Math.min(Math.max(totalPercentage, 0), 100));

    // Profile is complete if >= 95%
    const isProfileComplete = profileCompletion >= 95;

    return {
        profile_completion: profileCompletion,
        is_profile_complete: isProfileComplete,
    };
}
