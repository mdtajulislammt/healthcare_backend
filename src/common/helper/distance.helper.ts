import { GoogleMapsService } from '../lib/GoogleMaps/GoogleMapsService';

interface DistanceResult {
    distance_miles?: number;
    distance_km?: number;
    distance_meters?: number;
}

interface CalculateDistanceParams {
    staff_latitude?: number;
    staff_longitude?: number;
    shift_latitude: number | null;
    shift_longitude: number | null;
}

/**
 * Distance Helper
 * Provides utilities for calculating distances between locations
 */
export class DistanceHelper {
    /**
     * Calculate driving distance between staff location and shift location
     * @param params Object containing staff and shift coordinates
     * @returns Distance data in miles, km, and meters, or empty object if calculation fails
     */
    static async calculateDistance(params: CalculateDistanceParams): Promise<DistanceResult> {
        const { staff_latitude, staff_longitude, shift_latitude, shift_longitude } = params;

        // Check if all required coordinates are available
        if (
            staff_latitude === undefined ||
            staff_longitude === undefined ||
            shift_latitude === null ||
            shift_longitude === null
        ) {
            return {};
        }

        try {
            const distanceResult = await GoogleMapsService.calculateDistance(
                { latitude: staff_latitude, longitude: staff_longitude },
                { latitude: shift_latitude, longitude: shift_longitude },
            );

            if (distanceResult) {
                return {
                    distance_miles: distanceResult.distance_miles,
                    distance_km: distanceResult.distance_km,
                    distance_meters: distanceResult.distance_meters,
                };
            }
        } catch (error) {
            console.error('Failed to calculate distance:', error.message);
        }

        return {};
    }
}

