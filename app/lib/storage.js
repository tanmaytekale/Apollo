import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@recent_detections';

export const saveDetection = async (type, label, confidence, content) => {
    try {
        const newDetection = {
            id: Date.now().toString(),
            type, // 'text' or 'image'
            label,
            confidence,
            content, // preview text or image uri
            timestamp: new Date().toISOString(),
        };

        const existingDetections = await getRecentDetections();
        const updatedDetections = [newDetection, ...existingDetections].slice(0, 20); // Keep last 20

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDetections));
        return updatedDetections;
    } catch (error) {
        console.error('Error saving detection:', error);
        return [];
    }
};

export const getRecentDetections = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
        console.error('Error fetching detections:', error);
        return [];
    }
};

export const clearDetections = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing detections:', error);
    }
};
