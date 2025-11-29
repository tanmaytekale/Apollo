import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveDetection } from '../lib/storage';

const { height } = Dimensions.get('window');

export default function DetectTextScreen({ navigation }) {
    const [text, setText] = useState('');
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

    const handleDetect = async () => {
        if (!text.trim()) {
            Alert.alert('Error', 'Please enter some text to analyze.');
            return;
        }

        setLoading(true);
        setResult(null);
        Keyboard.dismiss();

        try {
            // TODO: Replace with your actual ngrok/public URL
            const API_URL = 'https://pseudoskeletal-yung-implausibly.ngrok-free.dev/detect';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            // data.result is [Label, Detailed Text]
            setResult(data.result);

            // Save to recent detections
            await saveDetection('text', data.result[0], data.result[1], text);

        } catch (error) {
            Alert.alert('Error', 'Failed to analyze text. Make sure the server is running and accessible.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Detect Text</Text>
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Enter text to analyze:</Text>
                    <TextInput
                        style={styles.input}
                        multiline
                        placeholder="Paste or type text here..."
                        placeholderTextColor="#666"
                        value={text}
                        onChangeText={setText}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity
                        style={[styles.detectButton, loading && styles.buttonDisabled]}
                        onPress={handleDetect}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <>
                                <Text style={styles.detectButtonText}>Analyze Text</Text>
                                <Ionicons name="search" size={20} color="#000000" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
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
                            <Text style={styles.resultTitle}>Analysis Result</Text>
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
                                <Text style={styles.scanAgainText}>Analyze More</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </SafeAreaView>
        </TouchableWithoutFeedback>
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
    label: {
        color: '#FFFFFF',
        fontSize: 16,
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#1A1A1A',
        color: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        height: 200,
        fontSize: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
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
