import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/** Prevents silent white-screen deaths on web production. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[@ridefood/rider] ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <Text style={styles.title}>Không thể tải ứng dụng</Text>
        <Text style={styles.body}>
          {this.state.error.message || 'Đã xảy ra lỗi không xác định.'}
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => {
            this.setState({ error: null });
            if (typeof window !== 'undefined') window.location.reload();
          }}
        >
          <Text style={styles.btnLabel}>Tải lại</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7FBFC',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1A2B2E' },
  body: { fontSize: 14, color: '#6B7C80', textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8,
    backgroundColor: '#1BA8B5',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnLabel: { color: '#FFFFFF', fontWeight: '800' },
});
