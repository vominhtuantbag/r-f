import React from 'react';
import { Tabs } from 'expo-router';
import { RiderTabBar } from '../../src/components/navigation/RiderTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RiderTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="orders" options={{ title: 'Lịch sử' }} />
      <Tabs.Screen name="cart" options={{ title: 'Giỏ hàng' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Thông báo' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />
      {/* Food discovery remains routable from Home service grid / search */}
      <Tabs.Screen
        name="food"
        options={{
          href: null,
          title: 'Đồ ăn',
        }}
      />
    </Tabs>
  );
}
