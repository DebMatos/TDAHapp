const categoryColors = {
  inbox: '#6B8296',
  work: '#C86D51',
  personal: '#D4975A',
  exercise: '#769379',
  shopping: '#9580A1',
};

export const lightColors = {
  background: '#FAF9F6',
  surface: '#FFFDFC',
  surfaceSoft: '#F6F3EE',
  surfaceMuted: '#EFECE6',

  text: '#2F2A27',
  textSecondary: '#625A55',
  textMuted: '#817770',
  textFaint: '#AAA19B',

  border: '#E3DDD7',
  borderSoft: '#EFECE6',
  input: '#FFFFFF',
  placeholder: '#A0958E',
  backdrop: 'rgba(32, 28, 25, 0.34)',

  selection: '#8A9273',
  selectionSoft: '#F2F4EE',
  selectionText: '#6F765D',
  action: '#3A9BB7',
  onAction: '#FFFFFF',
  checkboxBorder: '#AAA19B',

  categories: {
    inbox: { color: categoryColors.inbox, surface: '#F4F6F7' },
    work: { color: categoryColors.work, surface: '#FBF0EC' },
    personal: { color: categoryColors.personal, surface: '#FDF6ED' },
    exercise: { color: categoryColors.exercise, surface: '#F4F7F5' },
    shopping: { color: categoryColors.shopping, surface: '#F8F6F9' },
  },

  success: '#6F8F78',
  completed: '#8F8983',
  danger: '#BD5B5B',
  now: '#ECC94B',
  timeOfDay: ['#68D391', '#F6E05E', '#F6AD55', '#FC8181', '#B794F4', '#7F9CF5'],
  timelineSegments: ['#88C096', '#E2C268', '#C86D51', '#D28873', '#9E8BB3', '#798CAE'],
  timelineGrid: '#FAF8F6',
  taskCardNeutral: '#F5F4F2',
  taskCardMuted: '#C7BFB9',
  taskCardBorder: '#E7E3DF',
};

export const darkColors = {
  background: '#141412',
  surface: '#1D1C1A',
  surfaceSoft: '#272522',
  surfaceMuted: '#302D29',

  text: '#F2EEE9',
  textSecondary: '#D0C8C0',
  textMuted: '#AAA098',
  textFaint: '#827A73',

  border: '#403B36',
  borderSoft: '#35312D',
  input: '#252321',
  placeholder: '#938A82',
  backdrop: 'rgba(0, 0, 0, 0.64)',

  selection: '#9AA582',
  selectionSoft: '#30352B',
  selectionText: '#B9C69B',
  action: '#64B9CD',
  onAction: '#141412',
  checkboxBorder: '#827A73',

  categories: {
    inbox: { color: '#9AB0C3', surface: '#293139' },
    work: { color: '#E18A6D', surface: '#382923' },
    personal: { color: '#E2B17A', surface: '#382F24' },
    exercise: { color: '#91B296', surface: '#29332C' },
    shopping: { color: '#B7A0C5', surface: '#332D38' },
  },

  success: '#91B296',
  completed: '#AAA098',
  danger: '#E27B7B',
  now: '#F0CE62',
  timeOfDay: ['#68D391', '#F6E05E', '#F6AD55', '#FC8181', '#B794F4', '#7F9CF5'],
  timelineSegments: ['#88C096', '#E2C268', '#C86D51', '#D28873', '#9E8BB3', '#798CAE'],
  timelineGrid: '#322F2B',
  taskCardNeutral: '#302D29',
  taskCardMuted: '#827A73',
  taskCardBorder: '#403B36',
};

export default lightColors;
