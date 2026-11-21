
import {
  createTask as createRemoteTask,
  updateTask as updateRemoteTask,
  deleteTask as deleteRemoteTask,
} from '../repositories/supabaseTaskRepository';

export const syncOperation = async (userId, operation, { signal, reportHttp } = {}) => {
  switch (operation.type) {
    case 'create':
      try {
        await createRemoteTask(userId, operation.task, signal, reportHttp);
      } catch (error) {
        // 23505: registo com este ID já existe.
        // Não sobrescrever a tarefa remota.
        if (error.code !== '23505') {
          throw error;
        }
      }
      break;

    case 'update':
      await updateRemoteTask(userId, operation.task, signal, reportHttp);
      break;

    case 'delete':
      await deleteRemoteTask(userId, operation.taskId, signal, reportHttp);
      break;

    default:
      throw new Error(
        `Operação desconhecida: ${operation.type}`,
      );
  }
};
