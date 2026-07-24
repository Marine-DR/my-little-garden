# Flowerbed Editor — Screen Design Plan

## 1. Feature objective

The flowerbed editor allows the user to:

- Create a new rectangular or circular flowerbed.
- Open and modify an existing flowerbed.
- Define or update the flowerbed dimensions.
- Drag plants from a sidebar onto the flowerbed.
- Position and reposition each plant freely.
- See the space required by every plant.
- Identify spacing problems immediately.
- Duplicate or delete placed plants.
- View the quantities required to create the flowerbed in real life.
- Save the design explicitly.

The editor does not prevent invalid arrangements. Overlaps and plants extending outside the flowerbed are shown as warnings, but the user may still save the design.

---

## 2. Main screen structure

The screen is divided into five main areas:

1. Application header
2. Editor toolbar
3. Plant sidebar
4. Flowerbed canvas
5. Design summary panel

### 2.1 Application header

The existing application header remains visible at the top.

#### Left side

- Application icon
- “My Little Garden”
- Current page title: “Flowerbed design”
- Flowerbed name

Example:

**My Little Garden / Flowerbed design / Front garden**

#### Right side

- Save button
- Close or Back button

The header should reuse the existing application styling:

- White background
- Green application title
- 53 px height
- Primary green Save button
- Existing button dimensions and typography

#### Save states

**Saved**

- Save button enabled when manual saving remains available.
- Optional secondary text: “All changes saved.”

**Unsaved changes**

- Small amber dot next to the flowerbed name.
- Secondary text: “Unsaved changes.”
- Save button remains prominent.

**Saving error**

- Red inline message.
- “The design could not be saved.”
- Save button remains available for retry.

### 2.2 Editor toolbar

A horizontal toolbar appears below the application header and above the workspace.

#### Left section: flowerbed settings

- Shape selector
  - Rectangle
  - Circle
- Dimensions button
- Current dimensions summary

Examples:

- Rectangle — 4 m × 2.5 m
- Circle — 3 m diameter

Selecting **Dimensions** opens a compact modal or side panel.

#### Center section: view controls

- Zoom out
- Current zoom percentage
- Zoom in
- Fit flowerbed to screen
- Show or hide grid

Example:

`−   75%   +   Fit   Grid`

#### Right section: design status

Display a persistent summary:

- Number of placed plants
- Number of overlaps
- Number of plants outside the flowerbed

Example:

`24 plants · 2 overlaps · 1 outside`

Use status colors only for the warning values:

- Red for overlaps
- Amber for outside-boundary warnings
- Green or neutral text when there are no issues

---

## 3. Workspace layout

The main workspace uses a three-column layout.

### Recommended proportions for a 14-inch screen

- Plant sidebar: 260–280 px
- Canvas: flexible remaining width
- Summary panel: 260–300 px

At narrower widths, the summary panel can collapse into a drawer opened through a **Buying list** button.

The canvas must always receive the largest available area.

---

## 4. Plant sidebar

### 4.1 Purpose

The plant sidebar contains the plants available from the selected plant selection.

### 4.2 Sidebar header

Include:

- Title: “Plants”
- Search field
- Optional plant count
- Collapse button

Example:

**Plants**  
Search plants…  
12 plants available

### 4.3 Plant cards

Each plant is represented by a compact draggable card.

The card contains:

- Plant photo
- Plant name
- Required spacing or diameter
- Available colors
- Drag handle or drag affordance

Example:

**Cosmos**  
Spacing: 40 cm  
White · Pink · Red

### 4.4 Plant color selection

Color should normally be selected before placement, because the buying list separates quantities by plant and color.

Recommended interaction:

1. The user selects a color on the plant card.
2. The selected color remains active for that plant.
3. The user drags the plant onto the canvas.
4. The placed copy uses the selected color.
5. The user can change the color later through the selected plant panel.

This preserves the intended “select before placement” workflow while preventing the user from having to delete and replace a plant after a color mistake.

For plants with one color, no color selector is displayed.

For plants with several colors:

- Display color swatches.
- Show the selected swatch with a green outline.
- Include a readable color name in a tooltip or label.
- Do not rely on color alone for identification.

### 4.5 Drag states

**Default**

- Standard plant card.

**Hover**

- Light green background.
- Cursor changes to grab.

**Dragging**

- Card or plant preview follows the cursor.
- Cursor changes to grabbing.
- The canvas displays the future plant area.

**Unavailable plant data**

If spacing information is missing:

- Disable dragging.
- Show a warning icon.
- Tooltip: “Spacing information is required before this plant can be placed.”

---

## 5. Flowerbed canvas

### 5.1 Canvas presentation

The flowerbed is centered inside a neutral workspace.

The area outside the flowerbed uses the secondary background color.

The flowerbed itself uses:

- White or very light background
- Clear green or neutral outline
- Optional measurement grid
- Visible dimensions

The flowerbed should remain visually distinct from the general canvas.

### 5.2 Supported shapes

#### Rectangle

The user defines:

- Length
- Width
- Measurement unit

#### Circle

The user defines:

- Diameter
- Measurement unit

The flowerbed dimensions determine the canvas scale.

### 5.3 Changing dimensions

Dimensions can be changed at any time.

When dimensions change:

- Existing plants keep their current real-world coordinates.
- The flowerbed boundary updates.
- Plants are not automatically moved.
- Plants that now extend beyond the boundary become amber.
- Existing overlaps remain red.
- A temporary message appears:

> Flowerbed dimensions updated. Some plants may now extend outside the available area.

---

## 6. Plant representation on the canvas

### 6.1 Visual structure

Each plant is represented by two circles.

#### Plant marker

A smaller central circle representing the plant itself.  
Plant marker diameter = clamp(18 px, required-space diameter × 0.35, 42 px)

It displays:

- The selected flower color
- Optional abbreviated plant name or sequence number
- Selected outline when active

#### Required-space area

A larger translucent circle surrounding the plant marker.

Its diameter represents the real spacing required by that plant.

The required-space area remains visible for every plant, not only the selected plant. This helps users evaluate available space before placing another plant.

### 6.2 Space status colors

#### Valid spacing

Use green.

- Green outline
- Very light transparent green fill
- Indicates the space does not overlap another plant and remains inside the flowerbed

#### Overlap

Use red.

- Red outline
- Light transparent red fill
- Applies to all plants involved in the overlap
- Red warning icon may appear near the selected plant

#### Outside the flowerbed

Use amber.

- Amber outline
- Light transparent amber fill
- Applies when any part of the required-space area extends outside the flowerbed

#### Overlap and outside simultaneously

Use red as the dominant plant outline because overlap is the stronger conflict.

Add a small amber boundary-warning badge to indicate the second issue.

### 6.3 Accessibility

Do not communicate status using color alone.

Add distinct visual treatments:

- Valid: solid outline
- Outside: dashed outline
- Overlap: solid outline with cross-hatched or stronger warning pattern

Tooltips should state the exact status:

- “Spacing respected”
- “Overlaps with 2 plants”
- “Required space extends outside the flowerbed”
- “Overlaps and extends outside the flowerbed”

---

## 7. Placing a plant

### 7.1 Dragging from the sidebar

1. The user selects a plant color.
2. The user starts dragging the plant card.
3. A plant preview appears under the pointer.
4. Its required-space area is displayed at the correct canvas scale.
5. The area changes color continuously as the user moves it:
   - Green when valid
   - Red when overlapping
   - Amber when outside the boundary
6. The user releases the mouse to place the plant.
7. The plant remains selected after placement.

### 7.2 Dropping outside the canvas

If the pointer is released outside the flowerbed editor canvas:

- The plant is not created.
- The preview disappears.
- No warning dialog is needed.

### 7.3 Dropping in an invalid position

The plant is still created.

Display a brief non-blocking warning:

- “Plant placed with overlapping space.”
- “Plant placed partly outside the flowerbed.”

Provide an immediate **Undo placement** action within the notification, even if a full undo system is not included in this version.

---

## 8. Selecting and moving plants

### 8.1 Selection

Clicking a plant selects it.

Selected state:

- Strong green selection ring around the central marker
- Plant details displayed in the right panel
- Plant actions enabled

Clicking an empty area deselects it.

Only one plant is selected at a time in the initial version.

### 8.2 Moving

The user drags the selected or hovered plant directly.

During movement:

- The original position does not need to remain visible.
- Required-space validation updates continuously.
- Other affected plants also update their status.
- The right panel may show live coordinates or distances if later required.

After release:

- The plant remains selected.
- A warning appears only when the final position is invalid.
- The design becomes unsaved.

### 8.3 Mouse cursors

- Plant card: grab
- Dragging: grabbing
- Canvas empty area: default
- Plant marker: move
- Disabled action: not-allowed

---

## 9. Selected plant panel

When a plant is selected, the right panel displays plant-specific information instead of, or above, the general buying-list summary.

### Content

- Plant name
- Plant image
- Selected color
- Required spacing
- Current status
- Duplicate button
- Delete button

### Color control

For a multicolor plant, allow the color to be changed after placement.

Changing the color:

- Updates the plant marker.
- Updates the buying list immediately.
- Does not change position or spacing.
- Marks the design as unsaved.

### Status examples

**Spacing respected**

No overlap and entirely inside the flowerbed.

**Overlapping**

“Required space overlaps with Lavender 2 and Cosmos 4.”

**Outside flowerbed**

“12 cm of the required space extends outside the flowerbed.”

Precise measurements can be omitted from the initial version if they are technically expensive. A generic status is sufficient.

---

## 10. Duplicate plant

The user can duplicate the selected plant from:

- The selected plant panel
- A context menu opened by right-clicking the plant

The duplicate keeps:

- Plant type
- Selected color
- Required spacing

The duplicated plant appears slightly offset from the original so that it is visible and immediately draggable.

Because the two plants will initially overlap:

- Both spacing areas turn red.
- The duplicated plant remains selected.
- A helper message appears:

> Duplicate created. Drag it to a new position.

---

## 11. Delete plant

The user can delete the selected plant using:

- Delete button in the selected plant panel
- Keyboard Delete key, when focus is not inside a form field
- Optional context-menu action

Deletion does not require a confirmation dialog for a single plant because the action is easy to understand and the plant can be added again.

After deletion:

- The plant disappears.
- Overlap statuses of surrounding plants are recalculated.
- Buying-list quantities update.
- The design becomes unsaved.

A brief notification can provide:

> Plant deleted — Undo

---

## 12. Grid and zoom

### 12.1 Grid

The grid is optional and controlled from the toolbar.

#### Grid visible

- Use subtle neutral lines.
- Grid scale adapts to zoom.
- The grid is informational only.
- Plants do not snap to the grid in the initial version.

#### Grid hidden

- No grid lines.
- Flowerbed outline and plants remain visible.

The user’s preference may remain active during the current editing session.

### 12.2 Zoom

Provide:

- Zoom in
- Zoom out
- Fit to screen
- Zoom percentage

Recommended limits:

- Minimum: 25%
- Maximum: 300%

Zoom is centered around:

- The mouse pointer when using the mouse wheel
- The canvas center when using toolbar buttons

Zoom changes only the view. It does not change real dimensions or plant positions.

---

## 13. Buying-list access

### 13.1 Summary visible on the design screen

The right panel shows a compact, read-only buying-list summary.

Example:

**Plants to buy**

- Cosmos — 5
- Lavender — 3
- Echinacea — 2

Plants with several selected colors can appear as one total in the compact summary, with an expansion indicator.

Example:

**Cosmos — 5**  
2 colors

### 13.2 Detailed buying list

Selecting **View detailed list** opens a side panel or modal over the editor.

A side panel is recommended instead of a new operating-system window because it:

- Preserves the editor context.
- Works more predictably across Windows and Linux.
- Avoids popup-window management.
- Can remain responsive on smaller screens.

The detailed list separates plant colors.

Example:

- Cosmos — White — 2
- Cosmos — Pink — 3
- Lavender — Purple — 3

The list is read-only and always reflects the canvas.

### 13.3 Empty state

When no plants are placed:

**No plants added yet**

> Drag plants from the sidebar into the flowerbed to build your buying list.

---

## 14. Warning summary

Warnings should be visible without interrupting editing.

### 14.1 Persistent warning banner

When invalid plants exist, show a slim banner above the canvas.

#### Overlap only

“2 plants have overlapping required spaces.”

Red warning icon.

#### Outside only

“1 plant extends outside the flowerbed.”

Amber warning icon.

#### Both

“3 layout issues: 2 overlaps and 1 plant outside the flowerbed.”

Actions:

- Review issues
- Dismiss banner

Dismissing the banner does not remove plant-level warning colors.

### 14.2 Review issues

Selecting **Review issues** opens a compact list.

Example:

- Cosmos, white — overlaps Lavender
- Lavender — overlaps Cosmos
- Echinacea, pink — outside flowerbed

Selecting an item focuses and selects the corresponding plant on the canvas.

---

## 15. Save behavior

### 15.1 Explicit save

The user must select **Save** to persist the design.

Save includes:

- Flowerbed shape
- Flowerbed dimensions
- Plant type
- Plant color
- Plant coordinates
- Grid visibility, if considered a saved design preference
- Current zoom only if useful; otherwise treat zoom as session-only

### 15.2 Saving with warnings

Saving is allowed when overlaps or boundary issues exist.

On Save:

- Do not show a blocking confirmation every time.
- Save the design normally.
- Show a success message with warning information.

Example:

> Design saved with 3 layout warnings.

### 15.3 Leaving with unsaved changes

When the user:

- Navigates back
- Opens another design
- Leaves the editor
- Closes the application

and unsaved changes exist, show a confirmation dialog.

#### Dialog

**Save changes before leaving?**

“You have unsaved changes in ‘Front garden’. Leaving now will discard them.”

Actions:

- Save and leave
- Leave without saving
- Cancel

**Save and leave** is the primary action.

**Leave without saving** uses a destructive style.

**Cancel** returns to the editor.

No confirmation is shown when there are no unsaved changes.

---

## 16. Empty and loading states

### 16.1 New flowerbed before configuration

Show a setup card in the canvas:

**Create your flowerbed**

1. Select a shape.
2. Enter its dimensions.
3. Start adding plants.

Primary action: **Set flowerbed dimensions**

### 16.2 Configured flowerbed with no plants

Show the flowerbed area and an instructional message:

> Drag plants here to start your design.

### 16.3 Existing flowerbed loading

- Display canvas skeleton.
- Disable editing actions.
- Show “Loading design…”

### 16.4 Loading failure

**The flowerbed could not be loaded**

Actions:

- Try again
- Return to flowerbeds

---

## 17. Dimension dialog

### Rectangle fields

- Length
- Width
- Unit

### Circle fields

- Diameter
- Unit

### Validation

- Required
- Positive values only
- Reject zero
- Reject values outside supported technical limits
- Display field-level error messages

Example:

> Enter a width greater than 0.

### Existing design warning

When changing dimensions would place existing plants outside the boundary, do not block the change.

Show an informational message in the dialog:

> Plants will remain in their current positions. Some may extend outside the resized flowerbed.

Actions:

- Apply dimensions
- Cancel

---

## 18. Responsive behavior

The smallest target is a 14-inch laptop screen.

A practical baseline is approximately 1366 × 768, although the physical screen size alone does not define the resolution.

### At standard desktop widths

Display:

- Plant sidebar
- Canvas
- Summary panel

### At narrower widths

- Reduce sidebar width.
- Collapse the buying-list panel into a drawer.
- Keep the plant sidebar visible because it is essential to placement.
- Keep the toolbar actions in one or two compact rows.
- Avoid horizontal scrolling of the full page.
- Allow internal scrolling inside the plant sidebar and buying-list panel.

### Minimum canvas usability

The canvas should retain enough room to:

- Show the complete flowerbed through Fit to screen.
- Drag and place plants.
- Display warning areas legibly.

---

## 19. Primary interaction states

### State A — New design, no dimensions

- Canvas blocked from plant placement
- Shape and dimension setup highlighted
- Plant sidebar visible but dragging disabled

### State B — Empty configured flowerbed

- Canvas active
- Dragging enabled
- Buying list empty
- Save enabled if the configuration has not yet been saved

### State C — Valid design

- All plant areas green
- No warning banner
- Buying list reflects canvas

### State D — Overlapping plants

- Involved plant areas red
- Red warning count in toolbar
- Non-blocking warning banner
- Save remains enabled

### State E — Plant outside boundary

- Plant area amber with dashed outline
- Amber warning count in toolbar
- Save remains enabled

### State F — Plant overlapping and outside

- Red main outline
- Amber boundary badge
- Both issues listed in the status panel

### State G — Plant selected

- Strong selection ring
- Plant details and actions displayed
- Duplicate and delete enabled

### State H — Dragging a new plant

- Placement preview visible
- Live validation active
- Sidebar card displayed as dragging

### State I — Moving an existing plant

- Live validation active
- Affected surrounding plants update continuously

### State J — Unsaved changes

- Amber unsaved indicator
- Navigation-away confirmation active

### State K — Saved with warnings

- Saved status displayed
- Warning colors remain visible
- Warning banner remains available

---

## 20. Suggested screen hierarchy

### Header

My Little Garden  
Flowerbed design — Front garden  
Save  
Close

### Toolbar

Rectangle  
4 m × 2.5 m  
Change dimensions

Zoom controls  
Fit  
Grid

24 plants  
2 overlaps  
1 outside

### Main workspace

#### Left

Plant search  
Plant cards  
Color choices

#### Center

Flowerbed canvas  
Plant markers  
Required-space areas  
Warnings

#### Right

Selected plant details  
or  
Buying-list summary

### Bottom or overlay elements

Status notifications  
Unsaved warning dialog  
Detailed buying-list drawer  
Dimension dialog

---

## 21. Design recommendations

### Keep color selection before placement

Selecting the color before placement is relevant because the user is intentionally creating a real buying list. It also makes each placed copy visually meaningful immediately.

However, post-placement color editing should also be supported to correct mistakes without deleting and recreating plants.

### Use a side drawer for the detailed buying list

A side drawer is preferable to a new window. It preserves editing context and supports responsive layouts more reliably.

### Keep the spacing area permanently visible

This directly supports the core user goal: planning realistic spacing. To reduce visual noise:

- Use low-opacity fills.
- Use stronger outlines only for selected or invalid plants.
- Allow a future “Hide spacing areas” option, but do not include it in the first version unless user testing shows the canvas becomes too crowded.

### Allow invalid designs

Warnings should inform rather than prevent action. This gives the gardener control over intentional arrangements.
