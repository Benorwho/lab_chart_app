# Lab Chart App v0.3.0 - Enhanced Edition

## 🎉 What's New in v0.3.0

This enhanced version significantly improves user experience and interface design while maintaining all the powerful scientific data visualization features you need.

### ✨ Major UX Improvements

#### 1. **Workflow Progress Indicator**
- Clear 4-step workflow visualization at the top
- Visual feedback showing your current step
- Completed steps marked with green checkmarks
- Helps users understand where they are in the process

#### 2. **Collapsible Sidebar Panels**
- All configuration panels can now be collapsed/expanded
- Reduces visual clutter
- Click panel headers to toggle
- "Style" and "Export" panels collapsed by default to focus on core workflow

#### 3. **Data Preview**
- Instant feedback when data is loaded
- Shows row × column count
- Green success indicator
- Helps confirm data loaded correctly

#### 4. **Keyboard Shortcuts**
- **Ctrl+Z / Cmd+Z**: Undo (in table editor)
- **Ctrl+Y / Cmd+Y**: Redo (in table editor)
- **Ctrl+Shift+Z**: Alternative redo
- **Ctrl+Enter**: Quick compute or render
- **Esc**: Close help modal

#### 5. **Help System**
- New help button (?) in top bar
- Comprehensive modal with:
  - Workflow guide
  - Keyboard shortcuts reference
  - Usage tips
  - Quick start instructions

#### 6. **Better Visual Feedback**
- Improved button states with hover effects
- Animated transitions throughout
- Clear disabled states with helpful tooltips
- Loading animations
- Success/warning/error message styling

#### 7. **Enhanced Tooltips**
- Context-aware button tooltips
- Explains why buttons are disabled
- Shows keyboard shortcuts
- Guides users to next steps

#### 8. **Improved Accessibility**
- Better focus indicators
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast mode support
- Reduced motion support for accessibility

### 🎨 Visual Enhancements

- **Icons**: SVG icons throughout the interface for better visual recognition
- **Animations**: Smooth transitions and micro-interactions
- **Color-coded messages**: Success (green), warning (yellow), error (red)
- **Better button groups**: Organized controls with clear visual hierarchy
- **Improved spacing**: More breathing room between elements
- **Step badges**: Numbered workflow steps for easy reference

### 🚀 Performance & UX Features

- **Auto-render**: Chart renders automatically after compute
- **Live updates**: Option for instant chart updates in table editor mode
- **Better error messages**: More specific guidance when things go wrong
- **Responsive design**: Improved mobile/tablet layouts
- **Print styles**: Better appearance when printing charts

### 📋 Detailed Improvements by Section

#### Data Input
- Icons for upload and paste actions
- Better hint text with emojis
- Clearer file input styling
- Data preview shows immediately after parsing

#### Configuration
- Icons for settings categories
- Column selectors with better labels
- "(optional)" tags on optional fields
- Improved stats mode selector with explanations

#### Compute
- Clear step indicator
- Better disabled state messaging
- Keyboard shortcut support

#### Chart Options
- Grouped controls with icons
- Better filter multi-select with instructions
- Improved toggle switches
- Clearer option labels

#### Style & Export
- Collapsed by default (advanced features)
- Organized into logical groups
- Better input styling
- Resolution options clearly labeled

### 🔧 Technical Improvements

- Workflow state tracking
- Better state management
- Enhanced error handling
- Improved code organization
- Better commenting
- CSS custom properties for theming
- Reduced motion support
- High contrast mode support

## 📖 How to Use

### Quick Start

1. **Load Data** (Step 1)
   - Paste CSV/TSV data, or
   - Upload a CSV file, or
   - Click "Load Example" to see it in action

2. **Configure** (Step 2)
   - Select your ID column (required)
   - Choose Time and Condition columns (optional)
   - Pick replicate columns or use summary mode

3. **Compute** (Step 3)
   - Click "Compute" button
   - Statistics calculated automatically
   - Preview table shows results

4. **Visualize** (Step 4)
   - Chart renders automatically
   - Customize appearance in Style panel
   - Export as SVG, PNG, HTML, or PDF

### Table Editor Mode

- Click "Table Editor" tab to switch
- Add/delete rows and columns
- Paste blocks directly from Excel/Sheets
- Undo/redo with Ctrl+Z/Ctrl+Y
- Enable "Live compute" for instant updates

### Tips & Tricks

- **Replicate columns** are auto-detected by pattern: "rep 1", "replicate 2", "iter 3", etc.
- **Hold Ctrl/Cmd** to select multiple items in filters
- **Use filters** to show/hide specific IDs or conditions
- **Export at 2x-4x** resolution for publication-quality images
- **Press ? key** anytime to see the help modal
- **ESC key** closes dialogs and modals

## 🔒 Privacy & Security

- **100% client-side**: All processing happens in your browser
- **No uploads**: Files never leave your computer
- **No tracking**: No analytics or cookies
- **No storage**: Data clears when you close the tab
- **Export only**: Data only leaves via your explicit export actions

## 🆚 Comparison with v0.2.0

### What's Better

✅ Workflow guidance (new)
✅ Visual progress tracking (new)
✅ Collapsible panels (new)
✅ Keyboard shortcuts (new)
✅ Help system (new)
✅ Better tooltips (enhanced)
✅ Improved animations (enhanced)
✅ Data preview (new)
✅ Better accessibility (enhanced)
✅ Mobile responsive (improved)
✅ Better error messages (enhanced)

### What's the Same

✅ All data processing features
✅ Chart types and options
✅ Table editor functionality
✅ Export formats (SVG, PNG, HTML, PDF)
✅ Statistics calculations
✅ No storage/privacy guarantees

## 🎯 Use Cases

Perfect for:
- **Lab researchers**: Visualize experimental replicates
- **Students**: Create publication-ready charts
- **Data analysts**: Quick statistical summaries
- **Scientists**: Reproducible data visualization
- **Anyone**: Privacy-focused data charting

## 🐛 Known Limitations

- Requires modern browser (Chrome, Firefox, Safari, Edge)
- Large datasets (>10,000 rows) may be slow
- Plotly and html-to-image must be in `libs/` folder
- PDF export uses browser's print dialog

## 📝 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🤝 Feedback

Love it? Have suggestions? Found a bug?
Use the thumbs down button (if added) or contact the developer!

---

**Version**: 0.3.0
**Release Date**: 2026
**License**: Client-side only, no warranty
**Dependencies**: Plotly.js, html-to-image

---

Enjoy your enhanced Lab Chart App! 🚀📊
