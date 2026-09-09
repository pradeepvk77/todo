# Project Guidelines & UI Specifications

## Theme & Styling Rules
- **Framework**: Official `shadcn/ui` Light Theme system with Tailwind CSS v4.
- **Theme Variables**: Native Light theme (`bg-background` #ffffff, `text-foreground` #09090b, `bg-card` #ffffff, `bg-muted` #f4f4f5, `border-border` #e4e4e7).
- **Clean Aesthetic**: Crisp white cards, subtle borders, high-contrast dark text, clean muted tab controls.

## Component Guidelines
1. **Tabs Navigation (`Me` & `You`)**:
   - `TabsList` MUST use `grid grid-cols-2 w-full` to ensure `Me` and `You` tabs are equal 50/50 split spanning the exact width of the card container below.
   - `TabsContent` MUST have a minimum height (`min-h-[300px]`) so switching tabs causes zero layout jump/shift.
2. **Cards & List Items**:
   - Task items MUST use standard `shadcn/ui Card` and `CardContent` with `bg-card border-border shadow-xs`.
3. **Modal Dialog**:
   - Uses `shadcn/ui Dialog` for adding tasks (`AddTaskDialog.tsx`).
