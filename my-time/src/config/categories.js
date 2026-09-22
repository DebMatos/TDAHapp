import colors from '../theme/colors';

export const categories = {
  inbox: {
    id: 'inbox',
    label: 'Caixa de Entrada',
    icon: 'archive-outline',
    color: colors.categoryInbox,
    surface: '#F4F6F7',
  },

  work: {
    id: 'work',
    label: 'Trabalho',
    icon: 'briefcase-outline',
    color: colors.categoryWork,
    surface: '#FBF0EC',
  },

  personal: {
    id: 'personal',
    label: 'Pessoal',
    icon: 'home-outline',
    color: colors.categoryPersonal,
    surface: '#FDF6ED',
  },

  exercise: {
    id: 'exercise',
    label: 'Exercício',
    icon: 'barbell-outline',
    color: colors.categoryExercise,
    surface: '#F4F7F5',
  },

  shopping: {
    id: 'shopping',
    label: 'Compras',
    icon: 'cube-outline',
    color: colors.categoryShopping,
    surface: '#F8F6F9',
  },
};

export const categoryOptions =
  Object.values(categories);

export const getCategory = (categoryId) =>
  categories[categoryId] ??
  categories.inbox;