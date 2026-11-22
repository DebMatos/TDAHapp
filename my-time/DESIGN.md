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

The light application canvas uses warm stone `#EAE7E1`, with primary surfaces
at `#F5F2ED`. The active tracking panel uses that warm surface with the existing
`now` gold as its subtle outline and a low, diffuse shadow derived from the bee
floating button; its Android elevation is lower than the bee button. The dark
panel retains its existing surface, neutral border, and shadowless presentation.
Tracking controls keep their semantic `danger` and `completed` fills. In light
mode the stop icon uses `onAction` and the pause/play icon uses `text` for the
stronger contrast on each fill; dark-mode icons retain `text`. Geometry and
behavior are identical in both themes.

The active tracking panel shows a timestamp-derived `MM:SS` chronometer, keeping
total minutes beyond one hour. It recalculates from stored session boundaries and
the current instant on every tick; pausing therefore freezes at the persisted end
timestamp and resuming adds the new live interval. Historical totals and planned
durations retain their minute-only presentation and rounded calculation.

## Typography

Retain the application’s platform font and existing task-sheet hierarchy.

## Layout

`TaskSyncStatus` owns one fixed-size synchronization icon between “Agora” and
its header menu, plus a simple contextual overlay with a summary and navigation
to the dedicated synchronization screen. It reserves no region
below the header and never moves the timeline when status changes. The panel
closes through its close action, outside press or platform back/Escape. Header
text may truncate on narrow screens, while actions retain fixed hit regions.

`SyncStatusScreen` owns the detailed synchronization view. A centered cloud state
summarizes whether everything is confirmed; one stable card separates connection,
local queue, server upload and remote verification. Text and icons carry every
state, with theme tokens providing supporting color. Retry lives only on this
screen, remains disabled offline or while busy, and keeps its dimensions stable.
The screen is reachable from both the summary overlay and the navigation drawer.

In development builds, the synchronization screen shows an expandable diagnostic
history below the retry action. It keeps up to 40 entries in memory and retains
in-progress attempts as newer events arrive. Details show operation identifiers,
field names, timings, protocol results and state transitions. Task content and
session credentials are excluded.

Offline takes priority over activity, then errors, then confirmed synchronization.
Checking and queued work use neutral, non-rotating icons. Active synchronization
uses one two-second turn and respects reduced-motion preferences. Remote errors
remain available in the icon and the synchronization screen, including offline.
Colors come from `src/theme/colors.js`.

## Components

`TaskBanner` owns floating local task feedback without taking layout space. The
host passes through touches outside the banner. Local errors appear immediately
and remain until dismissed or a new local attempt starts.

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

Task synchronization starts only after both network reachability and an authenticated
session are confirmed. Pending work resumes on reconnection, on return to the
foreground, or after receipt of a valid access token. Authentication events track
account identity. The sync transport resolves the SDK token once per remote query,
with 8 seconds per refresh HTTP attempt, 45 seconds to obtain a token, and a
separate 15-second data deadline. Send and read failures retry independently at 5,
15, 30, then 60 seconds (remaining at 60 seconds), with the delay reset after a
successful operation. Duplicate online events respect the current delay. Validation
and conflict errors keep the first operation for the affected task available for review.
Unsent changes for the same task are compacted on local save and become eligible
after ten seconds of inactivity, capped at 30 seconds from the first edit. Other
tasks retain their own deadlines. A started request retains its payload. Failed
or cancelled attempts preserve pending operations and local task edits.
Local task and execution-session state is namespaced by authenticated user ID.
Changing accounts remounts navigation and invalidates queued work from the old
account. Ownerless legacy storage is deleted instead of being claimed by a user.

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
light and dark themes. Details places its save action outside the form scroll,
in a fixed right-aligned footer with 24 px horizontal padding. It uses the same
44-pixel button and upward arrow as Quick Create, respects the bottom safe area
when the keyboard is closed, adds 24 px of bottom spacing, and retains its validation and busy states.
A KeyboardAvoidingView owns keyboard avoidance in standalone and embedded Details;
the sheet does not add a second keyboard offset. Its fixed title starts editing
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

Quick Create exposes its date and start time as separate compact controls. They open
the existing inline calendar and time picker without expanding the sheet, updating
the same draft later transferred to Details. A touch on the timeline rounds only the
initial start time to the nearest 30 minutes; the picker retains minute precision.
The initial civil date comes from the selected timeline slot, including slots after
midnight. Save and expand carry the chosen civil date and time explicitly. Expansion
preserves raw title/notes and never persists a task. Shared date-input helpers
interpret stored dates without UTC conversion.

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
line. It presents its existing paired numeric HH:MM inputs directly, with no scroll
wheels, alternate selection path or entry animation. Hours and minutes remain separate
inputs inside one compact, left-aligned continuous rounded `surfaceSoft` panel, without internal gaps,
outlines or dividers. Focus does not alter the panel background; only the selected
field's digits change from `text` to `selection`. Tapping an input selects
its digits for replacement; automatic focus transfer keeps the cursor after any
transferred minute prefix. A valid time closes the picker immediately. No numeric
input is placed in the header. Its compact “Agora” shortcut uses the floating mascot
language, copies the device's current hours and minutes into the shared draft, and
closes the picker through the normal valid-time path without saving the task. Quick
Create marks its time pill with a selection-colored hairline while this picker is open.
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

Task execution uses one borderless section after the task properties, separated by
a hairline. Every edited task shows a clock row with the dynamically summed recorded
time and a chevron to the read-only session history. Pending tasks add a second,
equally aligned play row: “Iniciar” without sessions, “Continuar” with history, or
“Em execução” while active. Completed tasks omit execution actions and show only a
neutral natural-language comparison below the recorded total. The section never
repeats planned duration and uses no status color, card background or outline.

The session-history screen groups unique sessions chronologically by local civil
date and renders each one as a simple aligned time-and-duration row, without bullets,
cards, per-row dividers, or a repeated footer total. Session start and end timestamps
are rounded independently to the nearest minute in the shared session model; the
individual duration is their difference and the task total is the direct sum of
those durations. The same rounded endpoints drive the visible times, TaskDetails,
the active tracker, and history totals while persisted timestamps remain unchanged.
Open sessions use the current instant as their end. The screen is read-only, uses
neutral typography in light and dark themes, and provides loading, empty and safe
local-read failure states.
