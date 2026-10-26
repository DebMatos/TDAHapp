import { lightColors } from '../theme/colors';

const categoryDefinitions = {
  inbox: {
    id: 'inbox',
    label: 'Caixa de Entrada',
    icon: 'archive-outline',
  },

  work: {
    id: 'work',
    label: 'Trabalho',
    icon: 'briefcase-outline',
  },

  personal: {
    id: 'personal',
    label: 'Pessoal',
    icon: 'home-outline',
  },

  exercise: {
    id: 'exercise',
    label: 'Exercício',
    icon: 'barbell-outline',
  },

  shopping: {
    id: 'shopping',
    label: 'Compras',
    icon: 'cube-outline',
  },
};

export const getCategoryOptions = (colors = lightColors) =>
  Object.values(categoryDefinitions).map((category) => ({
    ...category,
    ...colors.categories[category.id],
  }));

export const getCategory = (categoryId, colors = lightColors) => {
  const category = categoryDefinitions[categoryId] ?? categoryDefinitions.inbox;
  return { ...category, ...colors.categories[category.id] };
};
