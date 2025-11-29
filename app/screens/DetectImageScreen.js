import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveDetection } from '../lib/storage';

const { height } = Dimensions.get('window');

export default function DetectImageScreen({ navigation }) {
    const [image, setImage] = useState(null);
    const [aspectRatio, setAspectRatio] = useState(1);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Animation value for the result sheet (starts off-screen)
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (result) {
            // Slide up
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        }
    }, [result]);

    const closeResult = () => {
        // Slide down
        Animated.timing(slideAnim, {
            toValue: height,
            duration: 300,
            useNativeDriver: true
        }).start(() => setResult(null));
    };

    const pickImage = async () => {
        // Reset result if picking new image
        if (result) closeResult();

        const resultPicker = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
        });

        if (!resultPicker.canceled) {
            const asset = resultPicker.assets[0];
            setImage(asset.uri);
            if (asset.width && asset.height) {
                setAspectRatio(asset.width / asset.height);
            }
        }
    };

    const handleDetect = async () => {
        if (!image) return;

        setLoading(true);
        setResult(null); // Clear previous result

        try {
            // TODO: Replace with your actual ngrok/public URL
            const API_URL = 'https://c25518ac927b.ngrok-free.app/detect-image';
            // For Android Emulator use http://10.0.2.2:8000/detect-image
            // For Physical Device use ngrok URL

            const formData = new FormData();
            formData.append('file', {
                uri: image,
                name: 'image.jpg',
                type: 'image/jpeg',
            });

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            // data.result is [Label, Description]
            setResult(data.result);

            // Save to recent detections
            await saveDetection('image', data.result[0], data.result[1], image);

        } catch (error) {
            Alert.alert('Error', 'Failed to detect image. Make sure the server is running and accessible.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Detect Image</Text>
            </View>

            <View style={styles.content}>
                <TouchableOpacity
                    style={[
                        styles.dropZone,
                        image && { aspectRatio: aspectRatio }
                    ]}
                    onPress={pickImage}
                >
                    {image ? (
                        <Image source={{ uri: image }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Feather name="image" size={48} color="#666" />
                            <Text style={styles.dropText}>Tap to select an image</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {image && (
                    <TouchableOpacity
                        style={[styles.detectButton, loading && styles.buttonDisabled]}
                        onPress={handleDetect}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <>
                                <Text style={styles.detectButtonText}>Detect AI Content</Text>
                                <Ionicons name="scan-outline" size={20} color="#000000" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Animated Result Sheet */}
            {result && (
                <Animated.View
                    style={[
                        styles.resultSheet,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.resultHeader}>
                        <Text style={styles.resultTitle}>Detection Result</Text>
                        <TouchableOpacity onPress={closeResult} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.resultBody}>
                        <View style={[
                            styles.statusIconContainer,
                            { backgroundColor: result[0] === 'AI Generated' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(68, 255, 68, 0.2)' }
                        ]}>
                            <Ionicons
                                name={result[0] === 'AI Generated' ? "alert-circle" : "checkmark-circle"}
                                size={64}
                                color={result[0] === 'AI Generated' ? "#FF4444" : "#44FF44"}
                            />
                        </View>

                        <Text style={[
                            styles.resultLabel,
                            { color: result[0] === 'AI Generated' ? "#FF4444" : "#44FF44" }
                        ]}>
                            {result[0]}
                        </Text>

                        <Text style={styles.resultConfidence}>
                            {result[1]}
                        </Text>

                        <TouchableOpacity style={styles.scanAgainButton} onPress={closeResult}>
                            <Text style={styles.scanAgainText}>Scan Another</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    dropZone: {
        width: '100%',
        minHeight: 200,
        borderWidth: 2,
        borderColor: '#333',
        borderStyle: 'dashed',
        borderRadius: 24,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        overflow: 'hidden',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    dropText: {
        color: '#888',
        marginTop: 16,
        fontSize: 16,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    detectButton: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    detectButtonText: {
        color: '#000000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    // Result Sheet Styles
    resultSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    resultTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    resultBody: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    statusIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    resultLabel: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    resultConfidence: {
        fontSize: 18,
        color: '#888',
        marginBottom: 32,
    },
    scanAgainButton: {
        backgroundColor: '#333',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    scanAgainText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
