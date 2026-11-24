import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GoogleGMark } from './GoogleGMark';
import { GOXE } from '../../../theme/goxe';

export function GoogleSignInButton({
  label = 'Tiếp tục với Google',
  loading = false,
  disabled = false,
  onPress,
}: {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        blocked && styles.btnDisabled,
        pressed && !blocked && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={GOXE.tealDark} />
      ) : (
        <View style={styles.content}>
          <GoogleGMark size={22} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5E7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 4px 12px rgba(8,30,34,0.06)' } as object,
      default: {},
    }),
  },
  btnPressed: {
    opacity: 0.92,
    backgroundColor: '#FAFCFC',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: GOXE.text,
  },
});
