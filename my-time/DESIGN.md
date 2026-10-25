# TDAHapp design context

## Overview

Preserve the existing quiet timeline and task sheets. Product copy is Portuguese,
using “tarefa”, “guardar” and “apagar”. Task feedback must preserve offline work
and distinguish a failed local write from a pending remote operation.

## Colors

`src/theme/colors.js` is the canonical runtime source. Use its surface, text,
textSecondary and selectionText roles for task feedback; do not change the palette
for error handling. Errors must be explained in text, not color alone.

## Typography

Retain the application’s platform font and existing task-sheet hierarchy.

## Layout

`TaskSyncStatus` owns persistent timeline synchronization feedback and retry.
Reserve its region below the header to avoid moving timeline controls as status
changes. Allow messages and actions to wrap on narrow screens.

## Components

`TaskErrorDialog` owns task-operation errors, including failed initial local reads.
Its shared `TaskErrorMessage` is rendered inside open forms instead of stacking
native modals.
Keep the task form open on local failure; close only after successful persistence.
Do not display raw server errors or task identifiers to users.

`src/data/taskSyncStatus.js` owns transient synchronization feedback. A failed send
must retain pending operations; a failed pull must retain local tasks. Retry must
not create another task. An empty status message makes no claim that all devices
or remote versions are reconciled.

Failed queue operations retain safe error categories, recognised protocol codes,
failed-attempt counts and timestamps. Unknown errors stay pending. Known data
rejections are labelled blocked but remain in FIFO order; retries are still
allowed and never silently discard or skip work. Correcting the displayed task
alone does not replace an earlier rejected operation. No queue-resolution UI is
provided yet.

## Do's and Don'ts

- Publish state only after persistence succeeds.
- Use accessible, labelled controls and polite status announcements.
- Never roll back local work because remote synchronization failed.
- Never clear storage or pending operations to recover from an error.
