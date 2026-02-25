import sys

with open('src/index.css', 'r') as f:
    content = f.read()

# We know the first part ends around line 175.
# Let's find the closing brace of light theme
split_target = "  --radius-full: 0;\n}\n"

if split_target in content:
    parts = content.split(split_target)
    
    new_vars = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Dark theme (default) - Premium Web3 Palette */
:root, [data-theme='dark'] {
  --bg-base: #09090b;
  --bg-raised: #18181b;
  --bg-surface: #27272a;
  --bg-elevated: #3f3f46;
  --bg-overlay: rgba(9, 9, 11, 0.85);

  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-tertiary: #71717a;
  --text-muted: #52525b;

  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --accent-muted: rgba(59, 130, 246, 0.15);
  --accent-glow: rgba(59, 130, 246, 0.4);
  --accent-bright: #93c5fd;

  --secondary: #8b5cf6;
  --secondary-muted: rgba(139, 92, 246, 0.15);

  --success: #10b981;
  --success-muted: rgba(16, 185, 129, 0.15);
  --warning: #f59e0b;
  --warning-muted: rgba(245, 158, 11, 0.15);
  --error: #ef4444;
  --error-muted: rgba(239, 68, 68, 0.15);

  --border: rgba(255, 255, 255, 0.1);
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-focus: rgba(59, 130, 246, 0.5);

  --gradient-primary: linear-gradient(135deg, #18181b 0%, #27272a 100%);
  --gradient-surface: linear-gradient(180deg, rgba(39,39,42,0.5) 0%, rgba(24,24,27,0.5) 100%);
  --gradient-card: linear-gradient(180deg, #18181b 0%, #27272a 100%);
  --gradient-glow: radial-gradient(ellipse at top, rgba(59,130,246,0.15) 0%, transparent 60%);
  --gradient-accent: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  --gradient-bg: linear-gradient(180deg, #09090b 0%, #18181b 100%);

  --gradient-hero: linear-gradient(135deg, #3b82f6 0%, #a855f7 100%);
  --text-on-accent: #ffffff;

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(59, 130, 246, 0.2);
  --shadow-card: 0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}

/* Light theme - Clean SaaS palette */
[data-theme='light'] {
  --bg-base: #f8fafc;
  --bg-raised: #ffffff;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f5f9;
  --bg-overlay: rgba(255, 255, 255, 0.85);

  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #64748b;
  --text-muted: #94a3b8;

  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-muted: rgba(37, 99, 235, 0.1);
  --accent-glow: rgba(37, 99, 235, 0.2);
  --accent-bright: #60a5fa;

  --secondary: #7c3aed;
  --secondary-muted: rgba(124, 58, 237, 0.1);

  --success: #059669;
  --success-muted: rgba(5, 150, 105, 0.1);
  --warning: #d97706;
  --warning-muted: rgba(217, 119, 6, 0.1);
  --error: #dc2626;
  --error-muted: rgba(220, 38, 38, 0.1);

  --border: #e2e8f0;
  --border-subtle: #f1f5f9;
  --border-focus: rgba(37, 99, 235, 0.3);

  --gradient-primary: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  --gradient-surface: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --gradient-card: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
  --gradient-glow: radial-gradient(ellipse at top, rgba(37,99,235,0.08) 0%, transparent 60%);
  --gradient-accent: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  --gradient-bg: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);

  --gradient-hero: linear-gradient(135deg, #2563eb 0%, #9333ea 100%);
  --text-on-accent: #ffffff;

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  --shadow-glow: 0 0 20px rgba(37, 99, 235, 0.1);
  --shadow-card: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.5);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}
"""
    
    with open('src/index.css', 'w') as f:
        f.write(new_vars + parts[1])
    print("Success")
else:
    print("Could not find split target")

