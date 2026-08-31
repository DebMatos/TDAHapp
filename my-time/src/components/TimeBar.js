import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function TimeBar() {
  const hours = Array.from({ length: 25 }, (_, i) => {
    const hour = (7 + i) % 24;
    return {
      id: i,
      hour,
      label: [7, 9, 12, 14, 18, 23, 7].includes(hour) 
        ? (hour < 10 ? `0${hour}` : `${hour}`) 
        : null,
      position: (i / 24) * 100,
    };
  });

  const getTickColor = (hour) => {
    if (hour >= 7 && hour < 9) return '#4A90B2';
    if (hour >= 9 && hour < 12) return '#48B555';
    if (hour >= 12 && hour < 14) return '#B2A644';
    if (hour >= 14 && hour < 18) return '#B36A48';
    if (hour >= 18 && hour < 23) return '#B3486B';
    return '#4A5CB3';
  };

  // Cálculo da hora atual (ciclo das 07:00 às 07:00)
  const now = new Date();
  const currentHourDecimal = now.getHours() + now.getMinutes() / 60;
  let hoursSinceSeven = currentHourDecimal - 7;
  if (hoursSinceSeven < 0) hoursSinceSeven += 24;
  const currentPosition = (hoursSinceSeven / 24) * 100;

  return (
    <View style={styles.container}>
      {/* Barra principal com os blocos recalculados a partir das 07:00 */}
      <View style={styles.barContainer}>
        <View style={[styles.block, { backgroundColor: '#78C1E2', width: '8.33%' }]} />  
        <View style={[styles.block, { backgroundColor: '#78E285', width: '12.5%' }]} />  
        <View style={[styles.block, { backgroundColor: '#E2D777', width: '8.33%' }]} />  
        <View style={[styles.block, { backgroundColor: '#E39978', width: '16.66%' }]} /> 
        <View style={[styles.block, { backgroundColor: '#E3789B', width: '20.83%' }]} /> 
        <View style={[styles.block, { backgroundColor: '#788AE3', width: '33.33%' }]} /> 

        {/* Abelha posicionada com base no novo ciclo das 07:00 */}
        <View style={[styles.insectWrapper, { left: `${currentPosition}%` }]}>
          <Image 
            source={require('../../assets/abelha.png')} 
            style={styles.beeIcon} 
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Régua de horas atualizada */}
      <View style={styles.scaleContainer}>
        {hours.map((item) => (
          <React.Fragment key={item.id}>
            <View 
              style={[
                styles.tick, 
                { 
                  left: `${item.position}%`,
                  backgroundColor: getTickColor(item.hour)
                }
              ]} 
            />
            {item.label && (
              <Text style={[styles.scaleText, { left: `${item.position}%` }]}>
                {item.label}
              </Text>
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginTop: 30, 
    marginBottom: 16,
    paddingHorizontal: 20, // <--- Aumentado de 4 para 20 para dar mais margem nas laterais
  },
  barContainer: {
    height: 9,
    flexDirection: 'row',
    borderRadius: 9,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: '#EFE6E1',
    backgroundColor: '#FAF5F0',
    position: 'relative',
  },
  block: { height: '100%' },
  insectWrapper: {
    position: 'absolute',
    bottom: 0, 
    alignItems: 'center',
    width: 64,
    marginLeft: -32,
    zIndex: 40,
  },
  beeIcon: {
    width: 32, 
    height: 32, 
  },
  tick: {
    position: 'absolute',
    top: -6,
    height: 5,
    width: 1,
    transform: [{ translateX: -0.5 }],
  },
  scaleContainer: { 
    height: 12, 
    marginTop: 0, 
    position: 'relative',
    marginHorizontal: 0,
  },
  scaleText: {
    position: 'absolute',
    top: 1,
    fontSize: 11,
    color: '#8C827B',
    fontWeight: '500',
    width: 28,
    textAlign: 'center',
    marginLeft: -14,
  },
});
