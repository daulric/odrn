import { getGravatarUrl } from '@/lib/getUserProfile';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeBetweenTabs } from '@/components/swipe-between-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { isCallingSupported } from '@/lib/calling/isCallingSupported';
import { createOutgoingCall } from '@/lib/calling/signaling';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Profile {
  id: string;
  username: string;
  avatar: string | null;
  email?: string;
}

interface FriendRequest {
  id: string;
  user_id: string; // The sender
  friend_id: string; // The receiver (me)
  status: 'pending' | 'accepted';
  sender: Profile;
}

interface Friend {
  id: string; // Connection ID
  friend: Profile; // The other person
  unread?: number; // Unread messages count
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { activeCall } = useCall();
  const router = useRouter();
  const callingSupported = isCallingSupported();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'people'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingCallUserId, setStartingCallUserId] = useState<string | null>(null);

  // Data states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (activeTab === 'friends') {
        await fetchFriends();
      } else if (activeTab === 'requests') {
        await fetchRequests();
      } else if (activeTab === 'people') {
        await fetchPeople();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!user) return;

    // Real-time subscription for unread counts
    const channel = supabase
      .channel('messages-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'ordn',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          if (activeTab === 'friends') {
            fetchFriends();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const fetchFriends = async () => {
    if (!user) return;

    // 1. Get all accepted friendship records
    const { data: sent, error: sentError } = await supabase
      .from('friends')
      .select('id, friend:profiles!friends_friend_id_fkey1(*)') 
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    const { data: received, error: receivedError } = await supabase
      .from('friends')
      .select('id, friend:profiles!friends_user_id_fkey1(*)')
      .eq('friend_id', user.id)
      .eq('status', 'accepted');

    if (sentError || receivedError) {
        console.log('Error fetching friends:', sentError || receivedError);
    }

    const allFriends: Friend[] = [
      ...(sent || []).map((item: any) => ({ id: item.id, friend: item.friend })),
      ...(received || []).map((item: any) => ({ id: item.id, friend: item.friend })),
    ];

    // 2. Fetch unread counts for each friend
    const friendIds = allFriends.map(f => f.friend.id);
    
    // We can't easily group by in Supabase JS client efficiently for this without RPC
    // So we'll just fetch all unread messages for me and count them client side
    // Or do a count query per friend (expensive).
    // Better: Fetch all unread messages for me, and count by sender_id.
    
    const { data: unreadData, error: unreadError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .eq('seen', false);

    if (unreadError) {
      console.error('Error fetching unread counts:', unreadError);
    }

    const unreadCounts: Record<string, number> = {};
    if (unreadData) {
      unreadData.forEach((msg: any) => {
        unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
      });
    }

    const friendsWithUnread = allFriends.map(f => ({
      ...f,
      unread: unreadCounts[f.friend.id] || 0
    }));

    setFriends(friendsWithUnread);
  };


  const fetchRequests = async () => {
    if (!user) return;
    // Fetch pending requests where I am the receiver (friend_id)
    const { data, error } = await supabase
      .from('friends')
      // WAS: friends_user_id_fkey
      // NOW: friends_user_id_fkey1
      .select('id, user_id, friend_id, status, sender:profiles!friends_user_id_fkey1(*)')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching requests:', error);
      return;
    }

    setRequests(data as any);
  };

  const fetchPeople = async () => {
    if (!user) return;
    
    // 1. Fetch all profiles except me
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id);

    if (profilesError) {
      console.error('Error fetching people:', profilesError);
      return;
    }

    // 2. Fetch all my connections (friends and pending requests)
    // We need to know who I have a relationship with to exclude them
    const { data: myConnections, error: connectionsError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError);
      return;
    }

    // 3. Create a set of IDs to exclude
    const excludedIds = new Set<string>();
    if (myConnections) {
      myConnections.forEach((connection: any) => {
        if (connection.user_id === user.id) excludedIds.add(connection.friend_id);
        if (connection.friend_id === user.id) excludedIds.add(connection.user_id);
      });
    }

    // 4. Filter profiles
    const filteredPeople = (allProfiles || []).filter((p: any) => !excludedIds.has(p.id));

    setPeople(filteredPeople as Profile[]);
  };

  // Actions
  const handleAcceptRequest = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await (supabase as any)
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', 'Could not accept request');
    } else {
      fetchRequests(); // Refresh
    }
  };

  const handleDeclineRequest = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await (supabase as any)
      .from('friends')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert('Error', 'Could not decline request');
    } else {
      fetchRequests(); // Refresh
    }
  };

  const handleAddFriend = async (otherUserId: string) => {
    if (!user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if already exists (optional, but good UX)
    // For now, just try insert
    const { error } = await (supabase as any)
      .from('friends')
      .insert({
        user_id: user.id,
        friend_id: otherUserId,
        status: 'pending',
      });

    if (error) {
      console.error(error);
      Alert.alert('Error', 'Could not send friend request');
    } else {
      Alert.alert('Success', 'Friend request sent!');
    }
  };

  const handleMessage = (userId: string, username: string) => {
    router.push(`/chat/${userId}?username=${username}`);
  };

  const isInCallWith = (userId: string) => {
    console.log("Checking isInCallWith:", { userId, activeCall, match: activeCall?.remoteUserId === userId });
    return activeCall?.remoteUserId === userId;
  };

  const handleCall = async (otherUserId: string) => {
    if (!user) return;
    if (!callingSupported) {
      Alert.alert('Calling unavailable', 'Calling requires a development build (not Expo Go).');
      return;
    }

    // If already in a call with this user, navigate back to that call
    if (activeCall && activeCall.remoteUserId === otherUserId) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/call/${activeCall.id}`);
      return;
    }

    try {
      setStartingCallUserId(otherUserId);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      const call = await createOutgoingCall({ callerId: user.id, calleeId: otherUserId });
      router.push(`/call/${call.id}`);
    } catch (e) {
      console.error('Failed to start call:', e);
      Alert.alert('Cannot start call', 'You can only call accepted friends.');
    } finally {
      setStartingCallUserId(null);
    }
  };

  const TabButton = ({ title, isActive, onPress }: { title: string; isActive: boolean; onPress: () => void }) => (
    <TouchableOpacity 
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      className={`flex-1 py-3 items-center border-b-2 ${isActive ? 'border-green-500' : 'border-transparent'}`}
    >
      <Text className={`text-base font-semibold ${isActive ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      );
    }

    if (activeTab === 'friends') {
      const filtered = friends.filter(f => 
        f.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      return (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                No friends yet. Go to People to find someone!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync();
                handleMessage(item.friend.id, item.friend.username);
              }}
              className="flex-row items-center px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
            >
              <Image
                source={{ uri: getGravatarUrl(item.friend.email || item.friend.username) }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
              />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.friend.username}
                </Text>
                <Text className="text-sm text-green-600 dark:text-green-500">
                  Connected
                </Text>
              </View>
              {item.unread ? (
                <View className="bg-red-500 min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">
                    {item.unread}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    void handleCall(item.friend.id);
                  }}
                  disabled={!callingSupported || startingCallUserId === item.friend.id}
                  className={`px-3 py-1.5 rounded-full flex-row items-center ${
                    isInCallWith(item.friend.id) ? 'bg-green-500' :
                    callingSupported ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  <Ionicons 
                    name={isInCallWith(item.friend.id) ? "arrow-undo" : "call-outline"} 
                    size={16} 
                    color={isInCallWith(item.friend.id) ? '#ffffff' : callingSupported ? '#1d4ed8' : '#6b7280'} 
                    style={{ marginRight: 4 }} 
                  />
                  <Text className={`${
                    isInCallWith(item.friend.id) ? 'text-white' :
                    callingSupported ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                  } font-medium text-xs`}>
                    {!callingSupported ? 'Dev build' : 
                     startingCallUserId === item.friend.id ? 'Calling…' : 
                     isInCallWith(item.friend.id) ? 'Return to Call' : 'Call'}
                  </Text>
                </TouchableOpacity>

                <View className="bg-green-100 dark:bg-green-900 px-3 py-1.5 rounded-full flex-row items-center">
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={activeTab === 'friends' ? '#15803d' : '#86efac'} style={{ marginRight: 4 }} />
                  <Text className="text-green-700 dark:text-green-300 font-medium text-xs">
                    Message
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeTab === 'requests') {
       const filtered = requests.filter(r => 
        r.sender.username.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                No pending requests.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
              <Image
                source={{ uri: getGravatarUrl(item.sender.email || item.sender.username) }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
              />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.sender.username}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Sent you a friend request
                </Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity 
                  onPress={() => handleAcceptRequest(item.id)}
                  className="bg-green-500 w-8 h-8 rounded-full items-center justify-center"
                >
                  <Ionicons name="checkmark" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleDeclineRequest(item.id)}
                  className="bg-red-500 w-8 h-8 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      );
    }

    if (activeTab === 'people') {
      const filtered = people.filter(p => 
        p.username.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                No users found.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
              <Image
                source={{ uri: getGravatarUrl(item.email || item.username) }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
              />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.username}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  User
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => handleAddFriend(item.id)}
                className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 flex-row items-center"
              >
                <Ionicons name="person-add-outline" size={16} color="#4b5563" style={{ marginRight: 4 }} />
                <Text className="text-gray-900 dark:text-white font-medium text-xs">
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }
  };

  return (
    <SwipeBetweenTabs current="messages">
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
        <View className="flex-1">
          {/* Header */}
          <View className="px-5 py-4 bg-white dark:bg-gray-900">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">
              Social
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row border-b border-gray-200 dark:border-gray-800">
            <TabButton 
              title="Friends" 
              isActive={activeTab === 'friends'} 
              onPress={() => setActiveTab('friends')} 
            />
            <TabButton 
              title="Requests" 
              isActive={activeTab === 'requests'} 
              onPress={() => setActiveTab('requests')} 
            />
            <TabButton 
              title="People" 
              isActive={activeTab === 'people'} 
              onPress={() => setActiveTab('people')} 
            />
          </View>

          {/* Search Bar */}
          <View className="px-5 py-3 bg-white dark:bg-gray-900">
            <TextInput
              className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-lg"
              placeholder={`Search ${activeTab}...`}
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Content */}
          <View className="flex-1 bg-gray-50 dark:bg-gray-950">
            {renderContent()}
          </View>
        </View>
      </SafeAreaView>
    </SwipeBetweenTabs>
  );
}
