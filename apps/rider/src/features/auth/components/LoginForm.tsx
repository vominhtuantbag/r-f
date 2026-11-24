import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthTextField } from './AuthTextField';
import { GoogleSignInButton } from './GoogleSignInButton';
import { OrDivider } from './OrDivider';
import { normalizePhone, validateLogin } from '../validation';
import { GOXE } from '../../../theme/goxe';

export function LoginForm({
  loading,
  googleLoading,
  error,
  onSubmit,
  onGoogle,
  onForgotPassword,
}: {
  loading: boolean;
  googleLoading?: boolean;
  error: string | null;
  onSubmit: (payload: { phone: string; password: string }) => Promise<void>;
  onGoogle: () => void;
  onForgotPassword?: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = loading || Boolean(googleLoading);

  const submit = async () => {
    const msg = validateLogin({ phone, password });
    if (msg) {
      setLocalError(msg);
      return;
    }
    setLocalError(null);
    await onSubmit({ phone: normalizePhone(phone), password });
  };

  return (
    <View style={styles.wrap}>
      <AuthTextField
        label="Số điện thoại"
        leftIcon="phone-portrait-outline"
        placeholder="Nhập số điện thoại"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={setPhone}
        editable={!busy}
      />
      <AuthTextField
        label="Mật khẩu"
        leftIcon="lock-closed-outline"
        placeholder="Nhập mật khẩu"
        secureTextEntry
        secureToggle
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />

      <Pressable style={styles.forgot} onPress={onForgotPassword} disabled={busy}>
        <Text style={styles.forgotLabel}>Quên mật khẩu?</Text>
      </Pressable>

      {localError || error ? (
        <Text style={styles.error}>{localError ?? error}</Text>
      ) : null}

      <Pressable
        style={[styles.cta, busy && styles.ctaDisabled]}
        disabled={busy}
        onPress={() => void submit()}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaLabel}>Đăng nhập</Text>
        )}
      </Pressable>

      <OrDivider />
      <GoogleSignInButton
        loading={Boolean(googleLoading)}
        disabled={busy && !googleLoading}
        onPress={onGoogle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  forgot: { alignSelf: 'flex-end', marginTop: -2 },
  forgotLabel: { color: GOXE.tealDark, fontWeight: '700', fontSize: 13 },
  error: { color: GOXE.danger, fontSize: 13, fontWeight: '600' },
  cta: {
    marginTop: 4,
    backgroundColor: GOXE.tealDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
