import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeTasks,
} from '../domain/taskModel';

const LEGACY_TASKS_STORAGE_KEY =
  '@my_time_tasks_data_v1';

const TASKS_STORAGE_KEY =
  '@my_time_tasks_data_v2';

const TASKS_SCHEMA_VERSION = 2;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const getDateKey = (date) => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};

/* -------------------------------------------------------
   WRITE
------------------------------------------------------- */

export const saveTasks =
  async (tasks) => {
    const canonicalTasks =
      normalizeTasks(
        tasks
      );

    const payload = {
      schemaVersion:
        TASKS_SCHEMA_VERSION,

      tasks:
        canonicalTasks,
    };

    await AsyncStorage.setItem(
      TASKS_STORAGE_KEY,
      JSON.stringify(
        payload
      )
    );

    return canonicalTasks;
  };

/* -------------------------------------------------------
   READ V2
------------------------------------------------------- */

const loadV2 =
  async () => {
    const stored =
      await AsyncStorage.getItem(
        TASKS_STORAGE_KEY
      );

    if (!stored) {
      return null;
    }

    const parsed =
      JSON.parse(
        stored
      );

    if (
      !parsed ||
      parsed.schemaVersion !==
        TASKS_SCHEMA_VERSION ||
      !Array.isArray(
        parsed.tasks
      )
    ) {
      return null;
    }

    return normalizeTasks(
      parsed.tasks
    );
  };

/* -------------------------------------------------------
   MIGRATION V1
------------------------------------------------------- */

const migrateV1 =
  async () => {
    const stored =
      await AsyncStorage.getItem(
        LEGACY_TASKS_STORAGE_KEY
      );

    if (!stored) {
      return null;
    }

    const parsed =
      JSON.parse(
        stored
      );

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return null;
    }

    /*
     * Antes do suporte de datas,
     * as tasks pertenciam implicitamente
     * ao dia atual.
     *
     * Este fallback existe apenas
     * durante a migração legacy.
     */
    const canonicalTasks =
      normalizeTasks(
        parsed,
        {
          fallbackDate:
            getDateKey(
              new Date()
            ),
        }
      );

    await saveTasks(
      canonicalTasks
    );

    return canonicalTasks;
  };

/* -------------------------------------------------------
   PUBLIC API
------------------------------------------------------- */

export const loadTasks =
  async () => {
    try {
      const v2 =
        await loadV2();

      if (v2) {
        return v2;
      }

      const migrated =
        await migrateV1();

      if (migrated) {
        return migrated;
      }

      return [];
    } catch (error) {
      console.error(
        'Erro ao carregar tarefas:',
        error
      );

      return [];
    }
  };

export const clearTasks =
  async () => {
    await AsyncStorage.removeItem(
      TASKS_STORAGE_KEY
    );
  };

export const TASK_STORAGE_INFO = {
  schemaVersion:
    TASKS_SCHEMA_VERSION,

  key:
    TASKS_STORAGE_KEY,

  legacyKey:
    LEGACY_TASKS_STORAGE_KEY,
};