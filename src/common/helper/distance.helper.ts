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
    private static readonly EARTH_RADIUS_KM = 6371;

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

        // Fall back to manual Haversine distance calculation if Google API fails / disabled
        return this.calculateApproximateDistance({
            staff_latitude,
            staff_longitude,
            shift_latitude,
            shift_longitude,
        });
    }
    // todo reminder
    //!!!!! remove this calculateApproximateDistance method after testing
    /**
     * Fallback approximate distance using Haversine formula (straight-line distance)
     */
    private static calculateApproximateDistance(params: Required<CalculateDistanceParams>): DistanceResult {
        const { staff_latitude, staff_longitude, shift_latitude, shift_longitude } = params;

        const toRad = (value: number) => (value * Math.PI) / 180;

        const latDiff = toRad(shift_latitude - staff_latitude);
        const lonDiff = toRad(shift_longitude - staff_longitude);

        const a =
            Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
            Math.cos(toRad(staff_latitude)) *
            Math.cos(toRad(shift_latitude)) *
            Math.sin(lonDiff / 2) *
            Math.sin(lonDiff / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = this.EARTH_RADIUS_KM * c;

        const distanceMeters = distanceKm * 1000;
        const distanceMiles = distanceKm * 0.621371;

        return {
            distance_meters: Math.round(distanceMeters),
            distance_km: Math.round(distanceKm * 10) / 10,
            distance_miles: Math.round(distanceMiles * 10) / 10,
        };
    }
}

