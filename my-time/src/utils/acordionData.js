export const INITIAL_TIMELINE_BLOCKS = [
  {
    id: 'amanhecer',
    title: 'Amanhecer',
    startHour: 7,
    endHour: 9,
    backgroundColor: '#E6F4F8',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'weather-hazy',
    iconColor: '#3A9BB7',
    tasks: [
      { id: 't1', title: 'Tomar pequeno-almoço', timeMinutes: 30, completed: true },
      { id: 't2', title: 'Rotina de mobilidade', timeMinutes: 30, completed: true },
    ],
  },
  {
    id: 'manha',
    title: 'Manhã',
    startHour: 9,
    endHour: 12,
    backgroundColor: '#EAF7EE',
    iconFamily: 'Ionicons',
    iconName: 'leaf',
    iconColor: '#34A853',
    tasks: [
      { id: 't3', title: 'Desenvolvimento da aplicação', timeMinutes: 60, completed: false },
    ],
  },
  {
    id: 'almoco',
    title: 'Almoço',
    startHour: 12,
    endHour: 14,
    backgroundColor: '#FFF9E6',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'food-variant',
    iconColor: '#D4A017',
    tasks: [
      { id: 't4', title: 'Almoço nutritivo', timeMinutes: 30, completed: false },
    ],
  },
  {
    id: 'tarde',
    title: 'Tarde',
    startHour: 14,
    endHour: 18,
    backgroundColor: '#FCEFEA',
    iconFamily: 'Ionicons',
    iconName: 'sunny',
    iconColor: '#D96B43',
    tasks: [],
  },
  {
    id: 'fim_do_dia',
    title: 'Fim do dia',
    startHour: 18,
    endHour: 23,
    backgroundColor: '#FCEBF2',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'weather-sunset',
    iconColor: '#C24D7A',
    tasks: [],
  },
  {
    id: 'noite',
    title: 'Noite',
    startHour: 23,
    endHour: 7,
    backgroundColor: '#EEF0FB',
    iconFamily: 'Ionicons',
    iconName: 'moon',
    iconColor: '#5C6BC0',
    tasks: [],
  },
];

export const INITIAL_TASKS = INITIAL_TIMELINE_BLOCKS.flatMap((block) => {
  let currentMinute = block.startHour * 60;

  return (block.tasks || []).map((task) => {
    const startMinsPlanned =
      task.startMinsPlanned ?? currentMinute;

    currentMinute =
      startMinsPlanned + (task.timeMinutes || 30);

    return {
      ...task,
      startMinsPlanned,
    };
  });
});
export const TIMELINE_PERIODS = INITIAL_TIMELINE_BLOCKS.map(
  ({ tasks, ...period }) => period
);