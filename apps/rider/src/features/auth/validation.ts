export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 9) return `+84${digits.slice(1)}`;
  if (digits.length >= 9) return `+84${digits}`;
  return raw.trim();
}

export function isValidVnPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(local);
}

export function validateLogin(input: {
  phone: string;
  password: string;
}): string | null {
  if (!input.phone.trim()) return 'Vui lòng nhập số điện thoại';
  if (!isValidVnPhone(input.phone)) return 'Số điện thoại không hợp lệ';
  if (!input.password) return 'Vui lòng nhập mật khẩu';
  return null;
}

export function validateRegister(input: {
  fullName: string;
  phone: string;
  phoneConfirm: string;
  password: string;
  passwordConfirm: string;
  acceptedTerms: boolean;
  showReferral: boolean;
  referralCode: string;
}): string | null {
  if (!input.fullName.trim()) return 'Vui lòng nhập họ tên';
  if (!input.phone.trim()) return 'Vui lòng nhập số điện thoại';
  if (!isValidVnPhone(input.phone)) return 'Số điện thoại không hợp lệ';
  if (input.phone.replace(/\D/g, '') !== input.phoneConfirm.replace(/\D/g, '')) {
    return 'Số điện thoại nhập lại không khớp';
  }
  if (input.password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự';
  if (input.password !== input.passwordConfirm) return 'Mật khẩu nhập lại không khớp';
  if (!input.acceptedTerms) return 'Vui lòng đồng ý với điều khoản sử dụng';
  if (input.showReferral && !input.referralCode.trim()) {
    return 'Vui lòng nhập mã giới thiệu hoặc tắt tuỳ chọn';
  }
  return null;
}
