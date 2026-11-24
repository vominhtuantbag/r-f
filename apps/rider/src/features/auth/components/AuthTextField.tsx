import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOXE } from '../../../theme/goxe';

export function AuthTextField({
  label,
  required,
  leftIcon,
  secureToggle,
  ...inputProps
}: {
  label?: string;
  required?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  secureToggle?: boolean;
} & TextInputProps) {
  const [secure, setSecure] = useState(Boolean(inputProps.secureTextEntry));
  const keyboardType: KeyboardTypeOptions =
    inputProps.keyboardType ?? (leftIcon === 'phone-portrait-outline' ? 'phone-pad' : 'default');

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.field}>
        {leftIcon ? (
          <View style={styles.leftBadge}>
            <Ionicons name={leftIcon} size={16} color={GOXE.tealDark} />
          </View>
        ) : null}
        <TextInput
          {...inputProps}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : null,
            secureToggle ? styles.inputWithEye : null,
            inputProps.style,
          ]}
          placeholderTextColor="#B0BABC"
          secureTextEntry={secureToggle ? secure : inputProps.secureTextEntry}
          keyboardType={keyboardType}
        />
        {secureToggle ? (
          <Pressable style={styles.eye} onPress={() => setSecure((v) => !v)} hitSlop={8}>
            <Ionicons
              name={secure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={GOXE.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: GOXE.text,
  },
  req: { color: GOXE.danger },
  field: {
    position: 'relative',
    justifyContent: 'center',
  },
  leftBadge: {
    position: 'absolute',
    left: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: GOXE.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: GOXE.border,
    backgroundColor: GOXE.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: GOXE.text,
  },
  inputWithLeft: {
    paddingLeft: 48,
  },
  inputWithEye: {
    paddingRight: 44,
  },
  eye: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
});
