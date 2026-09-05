import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface CelebrationOverlayProps {
  visible: boolean;
  type: 'four' | 'six' | 'wicket' | null;
  onDismiss: () => void;
}

export default function CelebrationOverlay({
  visible,
  type,
  onDismiss,
}: CelebrationOverlayProps) {
  const scaleAnim    = useRef(new Animated.Value(0.3)).current;
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible && type) {
      // Trigger haptic vibration safely
      try {
        if (type === 'six') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'four') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (type === 'wicket') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {
        // Haptics unavailable on web / simulator
      }

      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);

      // Spring in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 1.4 seconds
      const timer = setTimeout(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onDismissRef.current();
        });
      }, 1400);

      return () => clearTimeout(timer);
    }
  }, [visible, type, opacityAnim, scaleAnim]);

  if (!visible || !type) return null;

  const config = {
    four: {
      bg: '#ECFDF5',
      border: '#10B981',
      badgeBg: '#10B981',
      badgeText: '#FFFFFF',
      title: 'FOUR! 💥',
      sub: 'Glorious Boundary • 4 Runs',
      accentColor: '#047857',
    },
    six: {
      bg: '#FAF5FF',
      border: '#8B5CF6',
      badgeBg: '#7C3AED',
      badgeText: '#FFFFFF',
      title: 'MAXIMUM! 🚀',
      sub: 'Out of the Ground • 6 Runs',
      accentColor: '#6D28D9',
    },
    wicket: {
      bg: '#FEF2F2',
      border: '#EF4444',
      badgeBg: '#DC2626',
      badgeText: '#FFFFFF',
      title: 'WICKET! ⚡',
      sub: 'Huge Breakthrough • Batter Out',
      accentColor: '#B91C1C',
    },
  }[type];

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: config.bg,
              borderColor: config.border,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: config.badgeBg }]}>
            <Text style={[styles.badgeText, { color: config.badgeText }]}>
              {type === 'six' ? '6 RUNS' : type === 'four' ? '4 RUNS' : 'OUT'}
            </Text>
          </View>

          <Text style={[styles.title, { color: config.accentColor }]}>
            {config.title}
          </Text>

          <Text style={styles.sub}>{config.sub}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '88%',
    maxWidth: 360,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
});
