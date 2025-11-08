import appConfig from '../../../config/app.config';

interface GeocodeResult {
    latitude: number;
    longitude: number;
    formatted_address?: string;
}

interface DistanceResult {
    distance_meters: number;
    distance_km: number;
    distance_miles: number;
    duration_seconds?: number;
    duration_text?: string;
}

export class GoogleMapsService {
    private static readonly GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
    private static readonly DISTANCE_MATRIX_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

    /**
     * Convert address to coordinates using Google Geocoding API
     */
    static async geocodeAddress(address: string): Promise<GeocodeResult | null> {
        try {
            const apiKey = appConfig().googleMaps?.api_key;
            console.log('apiKey', apiKey);
            if (!apiKey) {
                console.warn('Google Maps API key not configured. Geocoding skipped.');
                return null;
            }

            const url = `${this.GEOCODING_API_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            console.log('data', data);

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const result = data.results[0];
                const location = result.geometry.location;

                return {
                    latitude: location.lat,
                    longitude: location.lng,
                    formatted_address: result.formatted_address,
                };
            } else {
                console.error('Geocoding failed:', data.status, data.error_message || '');
                return null;
            }
        } catch (error) {
            console.error('Error geocoding address:', error.message);
            return null;
        }
    }

    /**
     * Calculate driving distance between two coordinates using Google Distance Matrix API
     */
    static async calculateDistance(
        origin: { latitude: number; longitude: number },
        destination: { latitude: number; longitude: number },
    ): Promise<DistanceResult | null> {
        try {
            const apiKey = appConfig().googleMaps?.api_key;
            if (!apiKey) {
                console.warn('Google Maps API key not configured. Distance calculation skipped.');
                return null;
            }

            const originStr = `${origin.latitude},${origin.longitude}`;
            const destStr = `${destination.latitude},${destination.longitude}`;

            const url = `${this.DISTANCE_MATRIX_API_URL}?origins=${originStr}&destinations=${destStr}&key=${apiKey}&units=imperial`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.rows && data.rows.length > 0) {
                const row = data.rows[0];
                if (row.elements && row.elements.length > 0) {
                    const element = row.elements[0];
                    if (element.status === 'OK') {
                        const distanceMeters = element.distance.value; // Distance in meters
                        const distanceKm = distanceMeters / 1000;
                        const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles

                        return {
                            distance_meters: distanceMeters,
                            distance_km: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
                            distance_miles: Math.round(distanceMiles * 10) / 10, // Round to 1 decimal
                            duration_seconds: element.duration?.value,
                            duration_text: element.duration?.text,
                        };
                    } else {
                        console.error('Distance calculation failed:', element.status);
                        return null;
                    }
                }
            } else {
                console.error('Distance Matrix API error:', data.status, data.error_message || '');
                return null;
            }
        } catch (error) {
            console.error('Error calculating distance:', error.message);
            return null;
        }
    }
}

