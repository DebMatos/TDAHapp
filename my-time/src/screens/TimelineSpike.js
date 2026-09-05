import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_MINUTES = 24 * 60;
const DAY_START_MINUTE = 7 * 60;
const SNAP_MINUTES = 5;

// Limites de Zoom
const MAX_PPM = 3.5; // Zoom in máximo (muito perto)
const DEFAULT_PPM = 1.15;
const VERTICAL_PADDING = 24;

const AXIS_WIDTH = 52;
const CARD_LEFT = 64;
const CARD_RIGHT = 10;

const formatTime = (timelineMinute) => {
  const absolute = (DAY_START_MINUTE + timelineMinute + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const snap = (minutes) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

/* -------------------------------------------------------
   FUNÇÃO AUXILIAR PARA O ZOOM
------------------------------------------------------- */
const getPinchDistance = (touches) => {
  const [t1, t2] = touches;
  const dx = t1.pageX - t2.pageX;
  const dy = t1.pageY - t2.pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

/* -------------------------------------------------------
   TASK (Agora é 100% fluida e responsiva)
------------------------------------------------------- */
function DraggableTask({ task, ppm, onChangeStart, onDragStateChange }) {
  const dragY = useRef(new Animated.Value(0)).current;
  const startRef = useRef(task.startMinute);

  const realHeight = task.duration * ppm;
  const visualHeight = Math.max(16, realHeight);
  
  // Se a altura visual da tarefa for menor que 45px, mudamos para o design compacto
  const isCompact = visualHeight < 45;

  const top = task.startMinute * ppm + VERTICAL_PADDING;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: () => {
          startRef.current = task.startMinute;
          dragY.setValue(0);
          onDragStateChange?.(true);
        },

        onPanResponderMove: (_, gesture) => {
          dragY.setValue(gesture.dy);
        },

        onPanResponderRelease: (_, gesture) => {
          const deltaMinutes = gesture.dy / ppm;
          const nextStart = clamp(
            snap(startRef.current + deltaMinutes),
            0,
            DAY_MINUTES - task.duration
          );

          dragY.setValue(0);
          onChangeStart(nextStart);
          onDragStateChange?.(false);
        },

        onPanResponderTerminate: () => {
          dragY.setValue(0);
          onDragStateChange?.(false);
        },
      }),
    [dragY, onChangeStart, ppm, task.duration, task.startMinute, onDragStateChange]
  );

  if (isCompact) {
    return (
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.taskOverview,
          {
            top,
            height: visualHeight,
            left: CARD_LEFT,
            right: CARD_RIGHT,
            transform: [{ translateY: dragY }],
          },
        ]}
      >
        <View style={styles.overviewAccent} />
        <Text style={styles.overviewTaskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.overviewCheckbox} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.taskNormal,
        {
          top,
          height: visualHeight,
          left: CARD_LEFT,
          right: CARD_RIGHT,
          transform: [{ translateY: dragY }],
        },
      ]}
    >
      <View style={styles.normalAccent} />
      <View style={styles.taskText}>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={styles.taskMeta} numberOfLines={1}>
          {formatTime(task.startMinute)} – {formatTime(task.startMinute + task.duration)}
        </Text>
      </View>
      <View style={styles.checkbox} />
    </Animated.View>
  );
}

/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */
export default function TimelineSpike() {
  const scrollRef = useRef(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // ESTADO CONTÍNUO DO ZOOM (Pixels por Minuto)
  const [ppm, setPpm] = useState(DEFAULT_PPM);

  const [task, setTask] = useState({
    id: 'test-task',
    title: 'Dormir',
    startMinute: 0 * 60,
    duration: 120,
  });

  // Calcula qual é o limite máximo que o utilizador pode fazer Zoom Out para não quebrar o layout
  const minPpm = useMemo(() => {
    return viewportHeight > 0 
      ? (viewportHeight - VERTICAL_PADDING * 2) / DAY_MINUTES 
      : 0.3;
  }, [viewportHeight]);

  // Usamos refs para não ter de reconstruir o PanResponder a cada frame do zoom
  const ppmRef = useRef(ppm);
  useEffect(() => { ppmRef.current = ppm; }, [ppm]);
  
  const minPpmRef = useRef(minPpm);
  useEffect(() => { minPpmRef.current = minPpm; }, [minPpm]);

  // Altura total da tela baseada no zoom atual
  const timelineHeight = DAY_MINUTES * ppm;
  const canvasHeight = timelineHeight + VERTICAL_PADDING * 2;

  /* AGORA */
  const now = new Date();
  let nowMinute = now.getHours() * 60 + now.getMinutes() - DAY_START_MINUTE;
  if (nowMinute < 0) nowMinute += DAY_MINUTES;
  const nowTop = nowMinute * ppm + VERTICAL_PADDING;

  /* MARCADORES (Renderizamos sempre as 24h, mas escondemos visualmente se houver muito zoom) */
  const markerMinutes = useMemo(() => {
    return Array.from({ length: 25 }, (_, index) => index * 60);
  }, []);

  /* SCROLL PARA A TAREFA (Opcional, executa on mount) */
  const scrollToTask = useCallback(() => {
    if (!viewportHeight || !scrollRef.current) return;
    const target = task.startMinute * ppm + VERTICAL_PADDING - viewportHeight * 0.38;
    const maxScroll = Math.max(0, canvasHeight - viewportHeight);
    
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: clamp(target, 0, maxScroll), animated: false });
    });
  }, [task.startMinute, viewportHeight, canvasHeight, ppm]);

  useEffect(() => {
    if (viewportHeight > 0) {
      setTimeout(() => scrollToTask(), 100);
    }
  }, [viewportHeight]); // Só corre uma vez quando medimos o ecrã

  /* -------------------------------------------------------
     PAN RESPONDER DO ZOOM FLUIDO
  ------------------------------------------------------- */
  const pinchStartDistance = useRef(0);
  const initialPpm = useRef(1);

  const zoomResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,

        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            pinchStartDistance.current = getPinchDistance(evt.nativeEvent.touches);
            initialPpm.current = ppmRef.current; 
          }
        },

        onPanResponderMove: (evt) => {
          if (evt.nativeEvent.touches.length === 2 && pinchStartDistance.current > 0) {
            const currentDistance = getPinchDistance(evt.nativeEvent.touches);
            
            // O rácio entre a distância atual dos dedos e a distância inicial
            const scale = currentDistance / pinchStartDistance.current;
            
            // Calculamos o novo zoom limitando entre o mínimo (24h) e o máximo
            const nextPpm = clamp(initialPpm.current * scale, minPpmRef.current, MAX_PPM);
            setPpm(nextPpm);
          }
        },

        onPanResponderRelease: () => {
          pinchStartDistance.current = 0;
        },
        onPanResponderTerminate: () => {
          pinchStartDistance.current = 0;
        },
      }),
    []
  );

  // Variável para sabermos se o ecrã está muito "denso" (afastado)
  const isDense = ppm < 0.7;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Timeline Fluida</Text>
          <Text style={styles.subheading}>Faz pinch para zoom contínuo</Text>
        </View>
      </View>

      {/* TIMELINE ENVOLVIDA NO GESTO DE ZOOM */}
      <View
        {...zoomResponder.panHandlers}
        style={styles.timelineViewport}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!isDragging} // Já não bloqueamos o scroll manual a menos que estejas a arrastar a tarefa
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ height: canvasHeight }}
        >
          <View style={[styles.timelineCanvas, { height: canvasHeight }]}>
            
            {/* HORAS DINÂMICAS */}
            {markerMinutes.map((minute) => {
              const top = minute * ppm + VERTICAL_PADDING;
              const isOddHour = (minute / 60) % 2 !== 0;

              // Se a timeline estiver muito encolhida, omitimos o texto das horas ímpares
              const hideText = isDense && isOddHour;

              return (
                <View key={minute} style={[styles.hourRow, { top: top - 10 }]}>
                  <Text style={[styles.hourText, isDense && styles.hourTextOverview]}>
                    {!hideText ? formatTime(minute) : ''}
                  </Text>
                  <View style={[styles.hourLine, (isDense || hideText) && styles.hourLineOverview]} />
                </View>
              );
            })}

            {/* RÉGUA VERTICAL */}
            <View style={[styles.rail, { height: canvasHeight }]} />

            {/* TAREFA */}
            <DraggableTask
              task={task}
              ppm={ppm}
              onChangeStart={(startMinute) =>
                setTask((current) => ({ ...current, startMinute }))
              }
              onDragStateChange={setIsDragging}
            />

            {/* AGORA */}
            <View pointerEvents="none" style={[styles.nowLine, isDense && styles.nowLineOverview, { top: nowTop }]}>
              <View style={[styles.nowDot, isDense && styles.nowDotOverview]} />
              <Text style={[styles.nowLabel, isDense && styles.nowLabelOverview]}>
                AGORA
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerCopy: {
    alignItems: 'center',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  subheading: {
    fontSize: 12,
    marginTop: 4,
    color: '#8A8A8A',
  },
  timelineViewport: {
    flex: 1,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  timelineCanvas: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourText: {
    width: AXIS_WIDTH,
    paddingRight: 10,
    textAlign: 'right',
    fontSize: 11,
    color: '#A0A0A0',
  },
  hourTextOverview: {
    fontSize: 9,
    color: '#C0C0C0',
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  hourLineOverview: {
    backgroundColor: '#F8F8F8', // Linhas mais suaves quando afastado
  },
  rail: {
    position: 'absolute',
    top: 0,
    left: AXIS_WIDTH,
    width: 2,
    backgroundColor: '#EBEBEB',
  },
  nowLine: {
    position: 'absolute',
    left: AXIS_WIDTH,
    right: 6,
    height: 1,
    zIndex: 100,
    backgroundColor: '#FF4D85',
  },
  nowLineOverview: {
    opacity: 0.8,
  },
  nowDot: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF4D85',
  },
  nowDotOverview: {
    width: 5,
    height: 5,
    top: -2,
    left: -2,
  },
  nowLabel: {
    position: 'absolute',
    right: 0,
    top: -10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#FF4D85',
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  nowLabelOverview: {
    top: -7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 7,
  },
  taskNormal: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAF0FE',
    backgroundColor: '#F5F8FF',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  normalAccent: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: '#3B71F7',
  },
  taskText: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  taskMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#8A8A8A',
  },
  checkbox: {
    width: 20,
    height: 20,
    marginRight: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C0C0C0',
    backgroundColor: '#FFFFFF',
  },
  taskOverview: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EAF0FE',
    backgroundColor: '#F5F8FF',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  overviewAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#3B71F7',
  },
  overviewTaskTitle: {
    flex: 1,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  overviewCheckbox: {
    width: 10,
    height: 10,
    marginRight: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#C0C0C0',
    backgroundColor: '#FFFFFF',
  },
});