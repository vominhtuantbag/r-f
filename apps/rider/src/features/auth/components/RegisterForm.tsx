import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthTextField } from './AuthTextField';
import { GoogleSignInButton } from './GoogleSignInButton';
import { OrDivider } from './OrDivider';
import type { AuthMarketOption } from '../types';
import { normalizePhone, validateRegister } from '../validation';
import { GOXE } from '../../../theme/goxe';

export function RegisterForm({
  brandName,
  markets,
  selectedMarketId,
  onSelectMarket,
  loading,
  googleLoading,
  error,
  onSubmit,
  onGoogle,
}: {
  brandName: string;
  markets: AuthMarketOption[];
  selectedMarketId: string;
  onSelectMarket: (id: string) => void;
  loading: boolean;
  googleLoading?: boolean;
  error: string | null;
  onSubmit: (payload: {
    fullName: string;
    phone: string;
    password: string;
    marketId: string;
    referralCode?: string;
  }) => Promise<void>;
  onGoogle: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneConfirm, setPhoneConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = loading || Boolean(googleLoading);

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) ?? markets[0];

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length > 1 &&
      phone.trim().length >= 9 &&
      phoneConfirm.trim().length >= 9 &&
      password.length >= 8 &&
      password === passwordConfirm &&
      acceptedTerms
    );
  }, [acceptedTerms, fullName, password, passwordConfirm, phone, phoneConfirm]);

  const submit = async () => {
    const msg = validateRegister({
      fullName,
      phone,
      phoneConfirm,
      password,
      passwordConfirm,
      acceptedTerms,
      showReferral,
      referralCode,
    });
    if (msg) {
      setLocalError(msg);
      return;
    }
    setLocalError(null);
    await onSubmit({
      fullName: fullName.trim(),
      phone: normalizePhone(phone),
      password,
      marketId: selectedMarket?.id ?? '',
      referralCode: showReferral ? referralCode.trim() : undefined,
    });
  };

  const submitGoogle = () => {
    if (!acceptedTerms) {
      setLocalError('Vui lòng đồng ý với điều khoản trước khi tiếp tục với Google');
      return;
    }
    setLocalError(null);
    onGoogle();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Đăng ký tài khoản khách</Text>
      <Text style={styles.caption}>Tài khoản khách — dùng trên app {brandName}</Text>

      <AuthTextField
        label="Họ tên"
        required
        placeholder="VD: Nguyễn Văn A"
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
      />
      <AuthTextField
        label="Số điện thoại"
        required
        placeholder="VD: 0938123456"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <AuthTextField
        label="Nhập lại số điện thoại"
        required
        placeholder="VD: 0938123456"
        keyboardType="phone-pad"
        value={phoneConfirm}
        onChangeText={setPhoneConfirm}
      />

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Khu vực</Text>
        <Pressable style={styles.select} onPress={() => setPickerOpen(true)}>
          <Text style={styles.selectText}>{selectedMarket?.label ?? 'Chọn khu vực'}</Text>
          <Ionicons name="chevron-down" size={18} color={GOXE.textMuted} />
        </Pressable>
      </View>

      <Pressable
        style={styles.referralToggle}
        onPress={() => setShowReferral((v) => !v)}
      >
        <Ionicons name="gift-outline" size={18} color="#2E9E5B" />
        <Text style={styles.referralLabel}>Tôi có mã giới thiệu</Text>
        <Ionicons
          name={showReferral ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={GOXE.tealDark}
        />
      </Pressable>
      {showReferral ? (
        <AuthTextField
          placeholder="Nhập mã giới thiệu"
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
        />
      ) : null}

      <AuthTextField
        label="Mật khẩu"
        required
        placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
        secureTextEntry
        secureToggle
        value={password}
        onChangeText={setPassword}
      />
      <AuthTextField
        label="Nhập lại mật khẩu"
        required
        placeholder="Nhập lại mật khẩu"
        secureTextEntry
        secureToggle
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
      />

      <Pressable
        style={styles.termsRow}
        onPress={() => setAcceptedTerms((v) => !v)}
      >
        <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
          {acceptedTerms ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.termsText}>
          Tôi đồng ý với các{' '}
          <Text style={styles.termsLink}>QUY CHẾ SỬ DỤNG</Text>
          {' và '}
          <Text style={styles.termsLink}>CHÍNH SÁCH BẢO MẬT</Text>
          {` của ${brandName}`}
        </Text>
      </Pressable>

      {localError || error ? (
        <Text style={styles.error}>{localError ?? error}</Text>
      ) : null}

      <Pressable
        style={[styles.cta, (!canSubmit || busy) && styles.ctaMuted]}
        disabled={!canSubmit || busy}
        onPress={() => void submit()}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaLabel}>Đăng ký</Text>
        )}
      </Pressable>

      <OrDivider />
      <GoogleSignInButton
        loading={Boolean(googleLoading)}
        disabled={busy && !googleLoading}
        onPress={submitGoogle}
      />
      <Text style={styles.googleHint}>
        Google sẽ dùng khu vực {selectedMarket?.label ?? 'Sông Đốc, Cà Mau'} và các
        điều khoản bạn đã đồng ý.
      </Text>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn khu vực</Text>
            {markets.map((m) => (
              <Pressable
                key={m.id}
                style={styles.modalRow}
                onPress={() => {
                  onSelectMarket(m.id);
                  setPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalRowText,
                    m.id === selectedMarketId && styles.modalRowActive,
                  ]}
                >
                  {m.label}
                </Text>
                {m.id === selectedMarketId ? (
                  <Ionicons name="checkmark" size={18} color={GOXE.tealDark} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 4 },
  title: { fontSize: 17, fontWeight: '800', color: GOXE.text },
  caption: { marginTop: -6, marginBottom: 4, color: GOXE.textMuted, fontSize: 12 },
  fieldBlock: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: GOXE.text },
  select: {
    borderWidth: 1,
    borderColor: GOXE.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GOXE.surface,
  },
  selectText: { color: GOXE.text, fontSize: 14, fontWeight: '600' },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  referralLabel: { flex: 1, color: GOXE.tealDark, fontWeight: '700', fontSize: 13 },
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: GOXE.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: GOXE.tealDark,
    borderColor: GOXE.tealDark,
  },
  termsText: { flex: 1, fontSize: 12, color: GOXE.textSub, lineHeight: 18 },
  termsLink: {
    color: GOXE.tealDark,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  error: { color: GOXE.danger, fontSize: 13, fontWeight: '600' },
  cta: {
    marginTop: 2,
    backgroundColor: GOXE.tealDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaMuted: {
    backgroundColor: '#9ED7DD',
  },
  ctaLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  googleHint: {
    marginTop: -2,
    fontSize: 11,
    color: GOXE.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,30,34,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: GOXE.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: GOXE.text,
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GOXE.border,
  },
  modalRowText: { color: GOXE.text, fontSize: 14 },
  modalRowActive: { color: GOXE.tealDark, fontWeight: '700' },
});
