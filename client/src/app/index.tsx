import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="mx-auto w-full max-w-3xl flex-1">
        <View className="flex-1 justify-between px-7 py-5">
          <View className="flex-row items-center">
            <Image source={require('@/assets/images/secQRypt_logo.png')} className="mr-3 h-14 w-14 rounded-2xl" contentFit="contain" />
            <View><Text className="text-[22px] font-extrabold tracking-wide text-white">secQRypt</Text><Text className="mt-1 text-[9px] font-bold tracking-[2px] text-white">SECURE QR PAYMENTS</Text></View>
          </View>
          <View className="py-8">
            <Text className="mb-3 text-[11px] font-extrabold tracking-[2px] text-white">TRUST EVERY TRANSACTION</Text>
            <Text className="max-w-xl text-[42px] font-extrabold leading-[47px] text-white">Security that moves at your speed.</Text>
            <Text className="mt-4 max-w-lg text-base leading-6 text-white/70">A trusted QR payment workspace for people and businesses.</Text>
          </View>
          <View className="gap-3">
            <ActionButton icon="person.crop.circle.badge.checkmark" label="Log in" onPress={() => router.push('/role-selection')} />
            <ActionButton icon="person.badge.plus" label="Create an account" onPress={() => router.push('/role-selection')} inverted />
          </View>
          <Text className="mt-5 text-center text-xs tracking-wide text-white/70">Private by design. Ready when you are.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ActionButton({ icon, label, inverted, onPress }: { icon: string; label: string; inverted?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`min-h-14 flex-row items-center gap-3 rounded-xl border border-white px-4 ${inverted ? 'bg-white' : 'bg-black'}`}><SymbolView name={{ ios: icon, android: icon, web: icon } as never} size={21} tintColor={inverted ? '#000000' : '#FFFFFF'} /><Text className={`flex-1 text-base font-extrabold ${inverted ? 'text-black' : 'text-white'}`}>{label}</Text><SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' } as never} size={18} tintColor={inverted ? '#000000' : '#FFFFFF'} /></Pressable>;
}