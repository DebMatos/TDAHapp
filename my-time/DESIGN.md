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

Task sheets share presentation through `theme/styles/taskSheets.styles.js`:
surface, backdrop, top corners (22 px), handle (42 × 4), content inset (18 px), and
44-pixel buttons.
Their scoped `colors.taskSheet` tokens keep the dark backdrop black at 48%,
sheet surface `#302E2B`, and Quick Create chips `#252421` with a 1 px
`#34322F` outline. Picker surfaces and backdrops use the same sheet tokens;
picker layout stays unchanged. Text fields have no borders. The circular Quick
Create action retains its existing ring and geometry, uses an upward arrow,
and has no elevation or shadow. The Home bee button keeps its existing style.
Both sheets use the shared `actionButton` presentation with a yellow ring in
light and dark themes. Details keeps its header action position, uses a right
arrow, and retains its validation and busy states. Its fixed title starts editing
with focus in create mode; edit mode starts with the readable title. The existing
title focus effect is the sole owner of programmatic focus, including embedded
create details.
Quick Create has no bee image or ellipsis action. Its handle
alone captures touch immediately: the active handle widens and uses selection
text color. Up grows the sheet with the finger, then animates to Details height;
down closes, and short/cancelled drags spring back. The responder remains stable
across draft and active-state renders. Tapping the labelled handle provides an
accessible expansion alternative. Quick Create's submit is a fixed 44-pixel right
arrow beside the horizontally scrolling options; it keeps its accessible create
label and disabled/busy states. Expansion reuses the Quick Create native modal
with embedded Details instead of cross-fading two windows. Direct task editing
keeps its existing standalone modal and gestures. Embedded create details does
not automatically reopen the keyboard after the drag. Fields and horizontal options
do not own the sheet gesture. Details keeps its existing expansion/close behavior.

Quick Create date editing is inline with Today/Tomorrow shortcuts and a validated
DD/MM/YYYY field. The initial civil date comes from the selected timeline slot,
including slots after midnight. Save and expand carry the chosen civil date and
slot time explicitly. Expansion preserves raw title/notes and never persists a
task. Shared date-input helpers interpret stored dates without UTC conversion.

Task Details keeps its title fixed and its date/time/duration in a compact
horizontal line. Only one inline editor is open at a time. Text editors close on
blur or switching fields; selectors close on selection. Notes keep multiline input.
The sheet save action still owns persistence. Postponement actions share a compact horizontal bar,
including the existing Tomorrow shortcut. Read rows have no added surfaces or
borders, and category, priority and status colors retain their semantic roles.

Details date editing uses `InlineDatePicker` inside the form scroll, immediately
after the date/time/duration line and before category, without a second modal or native dialog. It has a Monday-first calendar,
Portuguese month/year heading, month navigation, and no past/future date limit.
Selection uses `selectionSoft`/`selectionText`, never yellow. The calendar has no
separate surface, border, height cap or internal scroll. Opening expands the sheet
to the screen's usable height; title, handle and save stay fixed, while the calendar
and other fields share the form scroll. Closing the calendar leaves the sheet expanded.
The form respects the Android bottom safe-area inset. Opening dismisses the keyboard;
the panel mounts only once the keyboard height is zero. Its entry animates only
translation, independent of the existing JS-driven sheet geometry. Form scrolling
keeps the calendar open; tapping the date again, closing, selecting a day, or opening
another editor closes it. Remounting starts at the selected month. The existing
date updater owns the postponement base and storage conversion remains unchanged.

Details start/end times use the same `InlineTimePicker`, inline after the schedule
line. Its independent hour (00–23) and minute (00–59) wheels snap to 44-pixel rows
with two neighbours visible on either side. Repeated cycles recenter without
animation only near an outer cycle, enabling circular scrolling without jumping
after every selection. Taps and typed values align to the nearest copy with a
scroll animation; the initial native offset stays fixed; nested Android scrolls
stay inside each wheel. Long-pressing the selected time opens one numeric HH:MM
pair of communicating inputs in the central wheel row, one in each original
number column, while neighbours remain visible. No numeric input is placed in
the header. Tapping an input selects its digits for replacement; automatic focus
transfer keeps the cursor after any transferred minute prefix. A short tap only selects
the wheel value.
Formatting and validation live in `utils/time.js` and are shared with Details.
Incomplete/invalid typing stays local to the picker. Completing a valid HH:MM
automatically updates the task draft and both wheels, ends numeric editing and
dismisses the keyboard; no apply button is needed. Wheel changes use the same value and handlers.
Only one date/time/editor is active; switching start/end remounts the picker and
discards unconfirmed text. Date and time pickers enter from above (negative Y to
zero), occupy real space, and push the following fields down. Start/end/duration,
postponement and save calculations remain owned by Details.

## Do's and Don'ts

- Publish state only after persistence succeeds.
- Use accessible, labelled controls and polite status announcements.
- Never roll back local work because remote synchronization failed.
- Never clear storage or pending operations to recover from an error.

Compact time entry reads hours from the first digit: 0–2 can accept a second hour
digit; 3–9 complete a one-digit hour, padded with zero. If a second hour digit
would exceed 23, it becomes the first minute digit: 241 → 02:41. Completed hours
automatically focus minutes. Backspace in empty minutes returns to the hour prefix. Examples: 99 → 09:09, 086 → 08:06, 236 → 23:06.
Minutes must stay within 00–59. A single minute digit 0–5 waits for a second
minute digit; 6–9 applies immediately as 06–09 because no valid two-digit minute
can start with it. Two minute digits apply immediately. There is no typing timer;
keyboard submit can explicitly complete a short valid input.
