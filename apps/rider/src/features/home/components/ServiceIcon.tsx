import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ServiceAction } from '../types';

interface ServiceIconProps {
  type: ServiceAction;
  size?: number;
}

export function ServiceIcon({ type, size = 28 }: ServiceIconProps) {
  const color = '#1A2B2E';

  switch (type) {
    case 'parcel':
      return <MaterialCommunityIcons name="package-variant-closed" size={size} color="#C47A20" />;
    case 'bike':
      return <MaterialCommunityIcons name="motorbike" size={size} color="#1BA8B5" />;
    case 'car':
      return <Ionicons name="car-sport" size={size} color="#2B7BBF" />;
    case 'truck':
      return <MaterialCommunityIcons name="truck-delivery" size={size} color="#3D5AFE" />;
    case 'food':
      return <MaterialCommunityIcons name="noodles" size={size} color="#E67E22" />;
    case 'grocery':
      return <MaterialCommunityIcons name="basket" size={size} color="#2E7D32" />;
    case 'retail':
      return <MaterialCommunityIcons name="shopping" size={size} color="#7B1FA2" />;
    case 'pet':
      return (
        <View style={styles.petRow}>
          <MaterialCommunityIcons name="dog" size={size - 4} color="#D81B60" />
          <Text style={styles.petGap}> </Text>
          <MaterialCommunityIcons name="cat" size={size - 4} color="#F57C00" />
        </View>
      );
    default:
      return <Ionicons name="apps" size={size} color={color} />;
  }
}

const styles = StyleSheet.create({
  petRow: { flexDirection: 'row', alignItems: 'center' },
  petGap: { width: 0 },
});
