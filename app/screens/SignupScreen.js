import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function SignupScreen({ navigation }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0.25)).current;

    const totalSteps = 4;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: step / totalSteps,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [step]);

    const animateToNextStep = (nextStepNum) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -50,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            setStep(nextStepNum);
            slideAnim.setValue(50);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        });
    };

    const handleNext = async () => {
        if (step === 1) {
            if (!name.trim()) {
                Alert.alert('Error', 'Please enter your name');
                return;
            }
            animateToNextStep(2);
        } else if (step === 2) {
            if (!email.trim() || !password.trim()) {
                Alert.alert('Error', 'Please enter email and password');
                return;
            }
            await signUpWithSupabase();
        } else if (step === 3) {
            if (!otp.trim()) {
                Alert.alert('Error', 'Please enter the verification code');
                return;
            }
            await verifyOtp();
        } else {
            navigation.replace('Home');
        }
    };

    const signUpWithSupabase = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        full_name: name,
                    },
                },
            });

            if (error) throw error;

            // Move to OTP step
            animateToNextStep(3);
        } catch (error) {
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
                Alert.alert(
                    'Account Exists',
                    'This email is already registered. Would you like to log in?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Go to Login', onPress: () => navigation.navigate('Login') }
                    ]
                );
            } else {
                Alert.alert('Signup Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp,
                type: 'signup',
            });

            if (error) throw error;

            // Move to Success step
            animateToNextStep(4);
        } catch (error) {
            Alert.alert('Verification Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 50,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start(() => {
                setStep(step - 1);
                slideAnim.setValue(-50);
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(slideAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    })
                ]).start();
            });
        } else {
            navigation.goBack();
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Let's get started</Text>
            <Text style={styles.stepSubtitle}>What should we call you?</Text>

            <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#666"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoFocus={true}
                />
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Secure your account</Text>
            <Text style={styles.stepSubtitle}>Enter your credentials</Text>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#666"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#666"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                    >
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Verify Email</Text>
            <Text style={styles.stepSubtitle}>Enter the code sent to {email}</Text>

            <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Verification Code"
                    placeholderTextColor="#666"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus={true}
                />
            </View>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#FFFFFF" />
            </View>
            <Text style={styles.stepTitle}>All Set!</Text>
            <Text style={styles.stepSubtitle}>Your account has been created successfully.</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={prevStep}
                        disabled={loading}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.progressBarContainer}>
                        <Animated.View
                            style={[
                                styles.progressBar,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.stepIndicator}>{step}/{totalSteps}</Text>
                </View>

                <Animated.View
                    style={[
                        styles.stepWrapper,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateX: slideAnim }]
                        }
                    ]}
                >
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                </Animated.View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>
                                    {step === totalSteps ? "Get Started" : step === 2 ? "Sign Up" : step === 3 ? "Verify" : "Next"}
                                </Text>
                                {step !== totalSteps && (
                                    <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 8 }} />
                                )}
                            </>
                        )}
                    </TouchableOpacity>

                    {step === 1 && (
                        <View style={styles.loginLinkContainer}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.linkText}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    progressBarContainer: {
        flex: 1,
        height: 4,
        backgroundColor: '#333333',
        borderRadius: 2,
        marginRight: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    stepIndicator: {
        color: '#666666',
        fontSize: 14,
        fontWeight: 'bold',
    },
    stepWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    stepContainer: {
        width: '100%',
    },
    stepTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 16,
        color: '#888888',
        marginBottom: 32,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },
    successIconContainer: {
        alignSelf: 'center',
        marginBottom: 24,
    },
    footer: {
        marginTop: 24,
    },
    button: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loginLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    footerText: {
        color: '#888888',
        fontSize: 14,
    },
    linkText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
