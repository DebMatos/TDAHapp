
import {
  createTask as createRemoteTask,
  updateTask as updateRemoteTask,
  deleteTask as deleteRemoteTask,
} from '../repositories/supabaseTaskRepository';

export const syncOperation = async (userId, operation) => {
  switch (operation.type) {
    case 'create':
      await createRemoteTask(userId, operation.task);
      break;

    case 'update':
      await updateRemoteTask(userId, operation.task);
      break;

    case 'delete':
      await deleteRemoteTask(userId, operation.taskId);
      break;

    default:
      throw new Error(
        `Operação desconhecida: ${operation.type}`,
      );
  }
};
