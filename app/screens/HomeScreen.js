import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getRecentDetections } from '../lib/storage';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [recentDetections, setRecentDetections] = useState([]);
    const [selectedDetection, setSelectedDetection] = useState(null);

    useEffect(() => {
        checkUser();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDetections();
        }, [])
    );

    const loadDetections = async () => {
        const detections = await getRecentDetections();
        setRecentDetections(detections);
    };

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
        } else {
            // navigation.replace('Login'); // Optional: force login
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            navigation.replace('Welcome');
        }
    };



    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Welcome,</Text>
                        <Text style={styles.username}>{user?.user_metadata?.full_name || 'User'}</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.uploadSection}>
                    <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate('DetectText')}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="text-outline" size={32} color="#FFFFFF" />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>Detect Text</Text>
                            <Text style={styles.optionSubtitle}>Detect AI-generated text</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#666" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate('DetectImage')}>
                        <View style={styles.iconContainer}>
                            <Feather name="image" size={32} color="#FFFFFF" />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>Detect Image</Text>
                            <Text style={styles.optionSubtitle}>Detect AI-generated images</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#666" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate('DetectVideo')}>
                        <View style={styles.iconContainer}>
                            <Feather name="video" size={32} color="#FFFFFF" />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>Detect Video</Text>
                            <Text style={styles.optionSubtitle}>Detect AI-generated videos</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Detections</Text>
                    {recentDetections.length > 0 ? (
                        <View style={styles.list}>
                            {recentDetections.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.listItem}
                                    onPress={() => setSelectedDetection(item)}
                                >
                                    <View style={[
                                        styles.listItemIcon,
                                        { backgroundColor: item.label === 'AI Generated' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(68, 255, 68, 0.1)' }
                                    ]}>
                                        <Ionicons
                                            name={item.type === 'text' ? "text-outline" : "image-outline"}
                                            size={24}
                                            color={item.label === 'AI Generated' ? "#FF4444" : "#44FF44"}
                                        />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{item.label}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            {item.type === 'text' ? 'Text Analysis' : 'Image Analysis'} • {item.confidence}
                                        </Text>
                                    </View>
                                    <Text style={styles.listItemTime}>
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="image" size={48} color="#333" />
                            <Text style={styles.emptyStateText}>No detections yet</Text>
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={!!selectedDetection}
                onRequestClose={() => setSelectedDetection(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detection Details</Text>
                            <TouchableOpacity onPress={() => setSelectedDetection(null)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            {selectedDetection?.type === 'image' ? (
                                <Image
                                    source={{ uri: selectedDetection.content }}
                                    style={styles.detailImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.textContainer}>
                                    <Text style={styles.detailText}>{selectedDetection?.content}</Text>
                                </View>
                            )}

                            <View style={styles.detailInfo}>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: selectedDetection?.label === 'AI Generated' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(68, 255, 68, 0.2)' }
                                ]}>
                                    <Ionicons
                                        name={selectedDetection?.label === 'AI Generated' ? "alert-circle" : "checkmark-circle"}
                                        size={24}
                                        color={selectedDetection?.label === 'AI Generated' ? "#FF4444" : "#44FF44"}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={[
                                        styles.statusText,
                                        { color: selectedDetection?.label === 'AI Generated' ? '#FF4444' : '#44FF44' }
                                    ]}>
                                        {selectedDetection?.label}
                                    </Text>
                                </View>

                                <Text style={styles.detailConfidence}>Confidence: {selectedDetection?.confidence}</Text>
                                <Text style={styles.detailTimestamp}>
                                    {selectedDetection && new Date(selectedDetection.timestamp).toLocaleString()}
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    content: {
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    greeting: {
        fontSize: 16,
        color: '#888888',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    logoutButton: {
        padding: 8,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
    },
    uploadSection: {
        marginBottom: 32,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333333',
    },
    iconContainer: {
        width: 56,
        height: 56,
        backgroundColor: '#333333',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    optionSubtitle: {
        fontSize: 14,
        color: '#888888',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333333',
    },
    emptyStateText: {
        color: '#666666',
        marginTop: 16,
        fontSize: 16,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333333',
    },
    listItemIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    listItemSubtitle: {
        fontSize: 14,
        color: '#888888',
    },
    listItemTime: {
        fontSize: 12,
        color: '#666666',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#333',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    detailImage: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        marginBottom: 24,
        backgroundColor: '#000',
    },
    textContainer: {
        width: '100%',
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    detailText: {
        color: '#FFFFFF',
        fontSize: 16,
        lineHeight: 24,
    },
    detailInfo: {
        width: '100%',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 32,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    detailConfidence: {
        fontSize: 18,
        color: '#888',
        marginBottom: 8,
    },
    detailTimestamp: {
        fontSize: 14,
        color: '#666',
    },
});
