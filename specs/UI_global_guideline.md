# Colors

```css
Default color #FFFFFFFF
Background 1 #F8FAF7FF
Background 2 #FAFBFAFF
Border  #E5E7EBFF
Primary Green #2F7D32FF
Light Green #E8F2E6FF
Primary button green hover #245E26FF
Secondary button green hover #F4FFEEFF
Primary text #000000FF
secondary text #969191FF
Delete button hover #FFDDDDFF
Delete or Error #DC2626FF
Warning #F59E0BFF
Secondary button disable #2F7D3280
Delete Button disable #dc262680
Sort button in table #F8FAF700
```

# Typography

```css
App title Inter SemiBold 20
Flower Name Inter SemiBold 16
Column name Inter SemiBold 14
Primary and secondary button text Inter Medium 14
Primary text Inter Regular 14
Secondary text Inter Regular 12
Current page and total number of Flower Inter SemiBold 12
Page navigation button Inter Medium 14
```

# Button Icons

edit 🖉  
document 🗋  
Other button icons are in a dedicated folder named Button-Icons

# Component style

## Buttons

### Primary buttons

#### Standard

- Background #2F7D32FF
- Text #FFFFFFFF Inter Medium 14
- Icons #FFFFFFFF
- Border #2F7D32FF 1px
- Button heigh 33px
- Button width ajusted to the content
- Icon heigh 16px
- Top and bottom margins 8px
- Left and right margins 10px
- Space between button element 5px
- Corner radius 4px for the 4 corners
- The button can contain only text or only 1 icon.
- Button can contain 2 icons, one at the right and on at the Left. In that case, the text is between the 2 icons.
- The icons that can be place at the right of the button are in the file Button-Icons/Right-Icons
- The icons that can be place at the left of the button are in the file Button-Icons/Left-Icons

#### Hover

The primary button state change on mouse hover. On hover, the background color change to #245E26FF and the border color change to #245E26FF


#### Disabled

When Primary button is disabled,apply the secondary button standard style and change the text color to #2f7d323f and the border color to #2f7d323f  
The mouse hover indicate not-allowed  
disabled title="Feature coming soon"

### Secondary buttons

#### Standard

- Background #FFFFFFFF
- Text #2F7D32FF Inter Medium 14
- Icons #2F7D32FF
- Border #2F7D32FF 1px
- Button heigh 33px
- Button width ajusted to the content
- Icon heigh 16px
- Top and bottom margins 8px
- Left and right margins 10px
- Space between button element 5px
- Corner radius 4px for the 4 corners
- The button can contain only text or only 1 icon.
- Button can contain 2 icons, one at the right and on at the Left. In that case, the text is between the 2 icons.
- The icons that can be place at the right of the button are in the file Button-Icons/Right-Icons
- The icons that can be place at the left of the button are in the file Button-Icons/Left-Icons

#### Hover

The sondary button state change on mouse hover. On hover, the background color change to #F4FFEEFF and the border color change to #F4FFEEFF

#### Disabled

When secondary button is disabled,apply the secondary button standard style and change the text color to #2F7D3280 and the border color to #2F7D3280

### Delete button

#### Standard

- Background #FFFFFFFF
- Text #DC2626FF Inter Medium 14
- Icons #DC2626FF
- Border #FFFFFFFF 1px
- Button heigh 33px
- Button width ajusted to the content
- Icon heigh 16px
- Top and bottom margins 8px
- Left and right margins 10px
- Space between button element 5px
- Corner radius 4px for the 4 corners
- The button can contain only a left icon and a text or only 1 icon.
- The bin icons that can be place at the left of the button are in the file Button-Icons/Left-Icons/bin.svg

#### Hover

The delete button state change on mouse hover. On hover, the background color change to #FFDDDDFF and the border color change to #FFDDDDFF

#### Disabled

When delete button is disabled,apply the delete button standard style and change the text color to #dc262680 and the border color to #dc262680

### Checkbox

#### Checked

- Size 20px by 20px
- Background #FFFFFFFF
- Border #E5E7EBFF
- Corner radius 3px for the 4 corners

#### Checked

- Size 20px by 20px
- Background Primary Green #2F7D32FF
- Border Primary Green #2F7D32FF
- Corner radius 3px for the 4 corners
- Icon color #FFFFFFFF
- Icon centered vertically and horizontally

### Pages navigation buttons

#### Standard

- Background #FFFFFFFF
- Text #2F7D32FF Inter Medium 12
- Icons #2F7D32FF
- Border #FFFFFFFF 1px
- Button heigh 31 px
- Button width ajusted to the content
- Icon heigh 16px
- Top and bottom margins 8px
- Left and right margins 10px
- Space between button element 5px
- Corner radius 4px for the 4 corners
- The button can contain only text or text with 1 icon.
- Button can contain 1 icon, at the right or on at the right of the text.
- The icons that can be place at the right of the button are in the file Button-Icons/Right-Icons
- The icons that can be place at the left of the button are in the file Button-Icons/Left-Icons

#### Hover

The page navigation button state change on mouse hover. On hover, the background color change to #F4FFEEFF and the border color change to #F4FFEEFF

#### Current page

To indicate what is the current page, the current page button use the same style as teh standard navigation page style except:

- Background #2F7D32FF
- Text #FFFFFFFF Inter Medium 12
- no icon
- Border #2F7D32FF 1px

### Enabled filter button

- Background #E8F2E6FF
- Text #2F7D32FF Inter Regular 12
- Icons #2F7D32FF
- Border #E8F2E6FF 1px
- Button heigh 26px
- Button width ajusted to the content
- Icon heigh 16px
- Top and bottom margins 5px
- Left and right margins 12px
- Space between button element 6px
- Corner radius 5px for the 4 corners
- The button contains text and 1 icon at the right.
- The icons that can be place at the right of the button are in the file Button-Icons/Right-Icons/close.svg

### Sort cells button

- Background F8FAF700
- Icon heigh 16px
- no border
- The icons that can be place at the right of the button are in the file Button-Icons/Right-Icons/sort.svg

## Text

- App title: Inter SemiBold 20 Primary Green #2F7D32
- Primary text: Inter Regular 14 #000000ff
- Secondary text: Inter Regular 12 #969191ff

## Header

## Table

All the screen with margins:

- Right and left 17px
- top and bottom 8px
  Table is centered horizontally.
  Footer, header and column name row always visible.

### Header

- Background #FFFFFFFF
- Text secondary text Style
- Border #E5E7EBFF 1px
- Secondary button style
- Top and bottom margins 8px
- Left and right margins 17px
- Text at the left and buttons at the right
- Space between buttons 15px

### Column name row

- Background #F8FAF7FF
- Text Inter SemiBold 14 #000000ff
- Border #E5E7EBFF 1px
- Cell heigh 40px
- Cell width according to the content
- Top and bottom margins 8px
- Left and right margins 8px
- Space between cell elements 3px
- Element centered centered both vertically and horizontally

### Other rows

- Background #FFFFFFFF
- Text Primary text Style
- Flowers name Inter SemiBold 16 #000000ff
- Border #E5E7EBFF 1px
- Cell heigh 81px
- Cell width according to the content
- Top and bottom margins 8px
- Left and right margins 8px
- Space between cell elements 3px
- Cells can contain: photo, button, icons, emoji or text
- Photo size 72px by 72 px
- Margins in photo cell 5px in all direction
- Icon heigh 16px
- Checkbox icon heigh 16 px and width 16px

### Footer

- Background #F8FAF7FF
- Text secondary text Style
- Border #E5E7EBFF 1px
- Pages navigation buttons style for pages navigation
- Standard secondary button style for number of elements by pages. No changement on mouse hover.
- Flowers number and total number of flowers in the list: Inter semi bold 12 #000000ff
- Top and bottom margins 15px
- Left and right margins 17px
- Flowers number and total number of flowers in the list at the right
- Page navigation buttons at the center
- Number of element by pages at the right

## Scrollbar

- color #2F7D32FF
- Background #FFFFFF00
- No border
- Width 5px
- Corner radius 5px
- When displayed to scroll in the table, displayed next to the table. Only on the scrolling content (no next to column name row and footer).

## Tool bar

Take all the width of the screen. Contains search bar, buttons and filter enabled button.

- Background #FAFBFAFF
- Border #E5E7EBFF 1px
- Top margins 20px
- Bottom margins 10px
- Right and left margins 18px
- Height 108px
- Width ajusted to the screen size
- Secondary Button style
- Enabled filter button style for filtrer currently applied
- Space between buttons 15px
- vertical space between elements 20px
- Search bar at the top left
- Buttons at the top right
- Enabled filter button at the bottom Left

### Search bar

- Background #FFFFFFFF
- Border #E5E7EBFF 1px
- Left and right margins 8px
- Top and left margins 8px
- Width 416px
- Boder coner 4px
- Default text in secondary text style
- Entered text in Primary text Style
- contain icon Button-Icons/Left-Icons/search.svg
- Icon size 18px by 18px in #969191FF

## Administration Actions

Take all the width of the screen.

- Background #FFFFFFFF
- Border #E5E7EBFF 1px
- Top and bottom margins 10px
- Right and Left margins 18px
- Space between buttons 15px
- Buttons style is Secondary buttons
- Button are at the Left

## App header

Always at the top of the screen. Take all the width of the screen.

- Background #FFFFFFFF
- Border #E5E7EBFF 1px
- Text App title style in #2F7D32FF
- Left margins 30px
- Right margins 18px
- Heigh 53px
- Content centered vertically
- Button style is Primary buttons
- Text is the name of the App My Little Garden
- Icon is Button-Icons/App-icon.svg in 36px by 36px
- Icon and App name at the Left with 15px between them
- Buttons at the right with 15 px between them
