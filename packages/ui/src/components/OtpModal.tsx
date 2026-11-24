import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import { defaultTheme } from '@ridefood/config';

export interface OtpModalProps {
  visible: boolean;
  mode: 'display' | 'input';
  /** 4-digit code when mode=display */
  code?: string | null;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm?: (code: string) => void;
  onClose?: () => void;
  error?: string | null;
  loading?: boolean;
}

const DIGITS = 4;

export function OtpModal({
  visible,
  mode,
  code,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
  error,
  loading = false,
}: OtpModalProps) {
  const [values, setValues] = useState<string[]>(Array.from({ length: DIGITS }, () => ''));
  const inputs = useRef<Array<TextInputType | null>>([]);

  useEffect(() => {
    if (!visible) {
      setValues(Array.from({ length: DIGITS }, () => ''));
    }
  }, [visible]);

  const displayCode = useMemo(() => {
    if (mode === 'display') {
      return (code ?? '----').padEnd(DIGITS, '·').slice(0, DIGITS).split('');
    }
    return values;
  }, [mode, code, values]);

  const filled = values.join('');

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    if (digit && index < DIGITS - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (digit && index === DIGITS - 1 && next.every(Boolean)) {
      onConfirm?.(next.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !values[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, defaultTheme.shadow(4)]}>
          <Text style={styles.title}>
            {title ?? (mode === 'display' ? 'Trip start code' : 'Enter trip OTP')}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.row}>
            {displayCode.map((d, i) =>
              mode === 'display' ? (
                <View key={`d-${i}`} style={styles.box}>
                  <Text style={styles.digit}>{d}</Text>
                </View>
              ) : (
                <TextInput
                  key={`i-${i}`}
                  ref={(ref) => {
                    inputs.current[i] = ref;
                  }}
                  style={styles.box}
                  value={values[i]}
                  onChangeText={(t) => handleChange(i, t)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  textAlign="center"
                  accessibilityLabel={`OTP digit ${i + 1}`}
                />
              ),
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {onClose ? (
              <Pressable style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryLabel}>Close</Text>
              </Pressable>
            ) : null}
            {mode === 'input' ? (
              <Pressable
                style={[styles.primaryBtn, (filled.length < DIGITS || loading) && styles.disabled]}
                disabled={filled.length < DIGITS || loading}
                onPress={() => onConfirm?.(filled)}
              >
                <Text style={styles.primaryLabel}>{loading ? 'Verifying…' : confirmLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: defaultTheme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: defaultTheme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: defaultTheme.colors.surface,
    borderRadius: defaultTheme.radii.lg,
    padding: defaultTheme.spacing.lg,
  },
  title: {
    fontSize: defaultTheme.typography.sizes.xl,
    fontWeight: defaultTheme.typography.weights.bold,
    color: defaultTheme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: defaultTheme.spacing.sm,
    color: defaultTheme.colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: defaultTheme.spacing.sm,
    marginTop: defaultTheme.spacing.lg,
  },
  box: {
    width: 56,
    height: 64,
    borderRadius: defaultTheme.radii.md,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.otpAccent,
    backgroundColor: defaultTheme.colors.bidHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: defaultTheme.colors.text,
  },
  digit: {
    fontSize: 28,
    fontWeight: '700',
    color: defaultTheme.colors.otpAccent,
    letterSpacing: 1,
  },
  error: {
    marginTop: defaultTheme.spacing.sm,
    color: defaultTheme.colors.danger,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: defaultTheme.spacing.sm,
    marginTop: defaultTheme.spacing.lg,
  },
  primaryBtn: {
    backgroundColor: defaultTheme.colors.primary,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingVertical: defaultTheme.spacing.sm + 2,
    borderRadius: defaultTheme.radii.md,
  },
  primaryLabel: {
    color: defaultTheme.colors.textInverse,
    fontWeight: defaultTheme.typography.weights.semibold,
  },
  secondaryBtn: {
    paddingHorizontal: defaultTheme.spacing.md,
    paddingVertical: defaultTheme.spacing.sm + 2,
  },
  secondaryLabel: { color: defaultTheme.colors.textMuted },
  disabled: { opacity: 0.5 },
});
