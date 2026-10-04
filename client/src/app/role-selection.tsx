import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, ShieldCheck, Store, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleSelectionScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="mx-auto w-full max-w-3xl flex-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="flex-row items-center gap-2 px-7 pt-4">
          <ArrowLeft size={22} color="#FFFFFF" />
          <Text className="text-sm text-white/70">Back</Text>
        </Pressable>

        <View className="flex-1 justify-center p-7">
          <Text className="mb-3 text-[11px] font-extrabold tracking-[2px] text-white">CHOOSE YOUR ACCOUNT TYPE</Text>
          <Text className="text-[38px] font-extrabold leading-[44px] text-white">How will you use secQRypt?</Text>
          <Text className="mb-8 mt-4 text-base leading-6 text-white/70">Choose a role, then log in or register securely.</Text>

          <View className="gap-3">
            <RoleButton icon={Users} title="Consumer" copy="Pay securely and keep your QR activity in one place." onPress={() => router.push('/auth?role=consumer&mode=login')} />
            <RoleButton icon={Store} title="Merchant" copy="Accept payments and monitor your business activity." onPress={() => router.push('/auth?role=merchant&mode=login')} />
            <RoleButton icon={ShieldCheck} title="Government / Admin" copy="Review merchant verification requests and consumer fraud reports." onPress={() => router.push('/auth?role=admin&mode=login')} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function RoleButton({ icon: Icon, title, copy, onPress }: { icon: typeof Users; title: string; copy: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Continue as ${title}`} onPress={onPress} className="min-h-[108px] flex-row items-center gap-3 rounded-xl border border-white bg-black p-4"><View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-white"><Icon size={28} color="#000000" strokeWidth={2.25} /></View><View className="flex-1"><Text className="text-lg font-extrabold text-white">{title}</Text><Text className="mt-1 text-[13px] leading-5 text-white/70">{copy}</Text></View><ArrowRight size={20} color="#FFFFFF" /></Pressable>;
}