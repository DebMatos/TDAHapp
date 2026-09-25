import colors from '../theme/colors';

export const categories = {
  inbox: {
    id: 'inbox',
    label: 'Caixa de Entrada',
    icon: 'archive-outline',
    color: colors.categories.inbox.color,
    surface: colors.categories.inbox.surface,
  },

  work: {
    id: 'work',
    label: 'Trabalho',
    icon: 'briefcase-outline',
    color: colors.categories.work.color,
    surface: colors.categories.work.surface,
  },

  personal: {
    id: 'personal',
    label: 'Pessoal',
    icon: 'home-outline',
    color: colors.categories.personal.color,
    surface: colors.categories.personal.surface,
  },

  exercise: {
    id: 'exercise',
    label: 'Exercício',
    icon: 'barbell-outline',
    color: colors.categories.exercise.color,
    surface: colors.categories.exercise.surface,
  },

  shopping: {
    id: 'shopping',
    label: 'Compras',
    icon: 'cube-outline',
    color: colors.categories.shopping.color,
    surface: colors.categories.shopping.surface,
  },
};

export const categoryOptions = Object.values(categories);

export const getCategory = (categoryId) =>
  categories[categoryId] ?? categories.inbox;
