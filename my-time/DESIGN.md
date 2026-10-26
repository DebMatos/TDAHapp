# TDAHapp design context

## Overview

Preserve the existing quiet timeline and task sheets. Product copy is Portuguese,
using “tarefa”, “guardar” and “apagar”. Task feedback must preserve offline work
and distinguish a failed local write from a pending remote operation.

## Colors

`src/theme/colors.js` is the canonical runtime source. Use its surface, text,
textSecondary and selectionText roles for task feedback; do not change the palette
for error handling. Errors must be explained in text, not color alone.

Functional colors are independent from category colors: `priority.low/medium/high`
identify priority, `saveAction` identifies unsaved editable work, and
`selectionIndicator` identifies the selected appearance option. Their values distinguish category identity from action and selection. They must not reference category
objects, even when their current hex values coincide. Category colors and surfaces
remain responsible for task identity; `now` remains responsible for current time.

Light text and controls use stronger contrast: action/save use blue-petrol
`#276E7A`; filled selection uses green `#66734F`; selection text/indicators
use `#596642`; muted text and placeholders use `#756B64`. Dark action/save use
`#79BCC8`, with selection indicators using `#B9C69B`. Yellow is reserved for
current time, not selected appearance preferences. Priority has its own
muted red/ochre/green palette. Category accents, category surfaces and timeline
segments remain unchanged. No new border, shadow or glow is introduced.

## Typography

Retain the application’s platform font and existing task-sheet hierarchy.

## Layout

`TaskSyncStatus` owns one fixed-size synchronization icon between “Agora” and
its header menu, plus a contextual overlay panel and retry. It reserves no region
below the header and never moves the timeline when status changes. The panel
closes through its close action, outside press or platform back/Escape. Header
text may truncate on narrow screens, while actions retain fixed hit regions.

Offline takes priority over activity, then errors, then confirmed synchronization.
Checking and queued work use neutral, non-rotating icons. Rotation occurs only
while sending or pulling and respects reduced-motion preferences. Error details
remain available offline. Colors come from `src/theme/colors.js`.

## Components

`TaskBanner` owns non-modal, floating task feedback without layout space. It sits
above the timeline near its bottom, or near the top inside an open task modal.
It never adds another modal or dims the interface. The host passes through touches
outside the banner. Local errors have priority over remote notices and remain
until dismissed or another local attempt starts. Informational notices expire
after six seconds; important errors require manual dismissal. No routine success
notifications are shown.

`taskSyncNotices.js` emits at most one remote notice per failure episode. Automatic
retries do not repeat it; confirmed recovery re-arms the next episode. Offline
failures are left in the header panel without an extra banner. Dismissing a banner
does not clear synchronization error details in the panel.
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

Task forms use the same pressed opacity (0.7), accessible labels for icon actions
and fields, and explicit disabled/busy semantics. Small form controls use at least
44-pixel action regions where their layout owns the target. Editing controls are
disabled while saving or deleting so later edits cannot be silently discarded.
The existing modal dismissal and drag gestures are unchanged. Failed writes leave
the draft open; error banners remain owned by the parent. Delete has its own busy
state and cannot run alongside save. No new confirmation or navigation is added.

Task cards keep their category accent in every status and zoom variant. Completed
and abandoned cards retain neutral surfaces and their existing text/status marks.
Card dimensions and gesture thresholds remain unchanged; tiny cards do not receive
overlapping enlarged hit regions. Screen-reader labels include category, status,
time and duration even when visual text is hidden. Android status-bar icons follow
the resolved app theme through the existing `expo-status-bar` dependency; no native
navigation-bar styling or system-theme configuration is changed in this step.

## Do's and Don'ts

- Publish state only after persistence succeeds.
- Use accessible, labelled controls and polite status announcements.
- Never roll back local work because remote synchronization failed.
- Never clear storage or pending operations to recover from an error.
