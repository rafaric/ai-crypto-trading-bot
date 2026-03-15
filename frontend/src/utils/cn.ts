type ClassValue = string | number | boolean | undefined | null | ClassArray | ClassDictionary;

interface ClassDictionary {
  [id: string]: boolean | undefined | null;
}

interface ClassArray extends Array<ClassValue> {}

function clsx(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  
  for (const input of inputs) {
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const result = clsx(...input);
      if (result) classes.push(result);
    } else if (typeof input === 'object' && input !== null) {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }
  
  return classes.join(' ');
}

function twMerge(className: string): string {
  // Simplified tailwind-merge: just return the className as-is
  // In production, you'd want the full tailwind-merge logic
  return className;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs));
}
