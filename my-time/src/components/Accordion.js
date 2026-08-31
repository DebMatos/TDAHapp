import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AccordionItem({
  title,
  taskProgress = '1/4',
  slotsProgress = '3/4 slots',
  backgroundColor = '#E6F4F8',
  iconFamily = 'Ionicons',
  iconName = 'leaf',
  iconColor = '#3A9BB7',
  isCurrentPeriod = false,
  expanded = true,          // <-- Estado controlado
  onToggle,                 // <-- Callback de clique individual
  children,
}) {
  const IconComponent = iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (onToggle) onToggle();
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={[
          styles.header,
          { backgroundColor },
          isCurrentPeriod && {
            borderWidth: 1,
            borderColor: iconColor || '#3A9BB7',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <IconComponent name={iconName} size={20} color={iconColor} style={styles.icon} />
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={12} color="#6B625C" />
            <Text style={styles.badgeText}>{slotsProgress}</Text>
          </View>

          <View style={styles.badge}>
            <Ionicons name="checkmark-done" size={12} color="#34A853" />
            <Text style={[styles.badgeText, { color: '#34A853' }]}>{taskProgress}</Text>
          </View>

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#6B625C"
          />
        </View>
      </TouchableOpacity>

      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2521',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B625C',
  },
  body: {
    paddingHorizontal: 2,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
});