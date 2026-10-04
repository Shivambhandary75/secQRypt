import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { login, register, type AuthRole } from '@/services/auth';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; mode?: string }>();
  const role: AuthRole = params.role === 'merchant' ? 'merchant' : params.role === 'admin' ? 'admin' : 'consumer';
  const [mode, setMode] = useState<'login' | 'register'>(params.mode === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [govId, setGovId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');

    if (!email.trim() || !password) {
      return setError('Enter your email and password.');
    }

    if (password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    if (mode === 'register' && !confirmPassword) {
      return setError('Confirm your password.');
    }

    if (mode === 'register' && password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (mode === 'register' && !username.trim()) {
      return setError('Enter a username.');
    }

    if (mode === 'register' && role === 'merchant' && !merchantId.trim()) {
      return setError('Enter your merchant ID.');
    }

    if (mode === 'register' && role === 'admin' && !govId.trim()) {
      return setError('Enter your government ID.');
    }

    setLoading(true);

    try {
      const payload = {
        role,
        email: email.trim(),
        password,
        ...(mode === 'register' ? { username: username.trim() } : {}),
        ...(mode === 'register' && role === 'merchant' ? { merchantId: merchantId.trim() } : {}),
        ...(mode === 'register' && role === 'admin' ? { govId: govId.trim() } : {}),
      };

      const user = mode === 'login' ? await login(payload) : await register(payload);
      router.replace(`/dashboard?role=${user.role}`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to connect to the server.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = 'mt-2 rounded-lg border border-white bg-black px-4 py-3 text-white';

  return (
    <View className="flex-1 bg-black">
      <View className="mx-auto w-full max-w-3xl flex-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="flex-row items-center gap-2 px-7 pt-4">
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'chevron_left' } as never} size={22} tintColor="#FFFFFF" />
          <Text className="text-sm text-white/70">Back</Text>
        </Pressable>

        <View className="flex-1 justify-center p-7">
          <Text className="text-[11px] font-extrabold tracking-[2px] text-white">{role === 'merchant' ? 'MERCHANT ACCESS' : role === 'admin' ? 'GOVERNMENT / ADMIN ACCESS' : 'CONSUMER ACCESS'}</Text>
          <Text className="mt-3 text-[38px] font-extrabold leading-[44px] text-white">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</Text>
          <Text className="mt-4 text-base leading-6 text-white/70">{role === 'admin' ? 'Review merchant applications and reports securely.' : mode === 'login' ? 'Log in to continue to your secure dashboard.' : 'Register to start using secQRypt securely.'}</Text>

          <View className="mt-7 gap-4">
            {mode === 'register' && role === 'merchant' && (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-white">Merchant ID</Text>
                <TextInput value={merchantId} onChangeText={setMerchantId} autoCapitalize="characters" placeholder="merchant ID" placeholderTextColor="#777777" className={fieldClass} />
              </View>
            )}

            {mode === 'register' && (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-white">Username</Text>
                <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="your username" placeholderTextColor="#777777" className={fieldClass} />
              </View>
            )}

            {mode === 'register' && role === 'admin' && (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-white">Government ID</Text>
                <TextInput value={govId} onChangeText={setGovId} autoCapitalize="characters" placeholder="government ID" placeholderTextColor="#777777" className={fieldClass} />
              </View>
            )}

            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-white">Email</Text>
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#777777" className={fieldClass} />
            </View>

            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-white">Password</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor="#777777" className={fieldClass} />
            </View>

            {mode === 'register' && (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-white">Confirm Password</Text>
                <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" placeholderTextColor="#777777" className={fieldClass} />
              </View>
            )}
          </View>

          {error ? <Text className="mt-4 text-sm font-medium text-red-500">{error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={submit} disabled={loading} className="mt-7 rounded-xl bg-white px-4 py-4">
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-center text-[18px] font-bold text-black">{mode === 'login' ? 'Log in' : 'Create account'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-6 self-center">
            <Text className="text-base text-white/70">
              {mode === 'login' ? 'Don’t have an account? ' : 'Already have an account? '}
              <Text className="font-semibold text-white">{mode === 'login' ? 'Sign up' : 'Log in'}</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
