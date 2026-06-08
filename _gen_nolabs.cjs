const fs = require('fs');
let c = fs.readFileSync('src/ui/screens/RiskScreen.tsx', 'utf8');

// Add forceNoLabs state
c = c.replace(
  "const [weekMode, setWeekMode] = useState<'week' | 'average'>('average');",
  "const [weekMode, setWeekMode] = useState<'week' | 'average'>('average');\n  const [forceNoLabs, setForceNoLabs] = useState(globalNoLabs);"
);

// Update globalNoLabs to use state (so toggle works)
c = c.replace(
  "const globalNoLabs = getGlobalNoLabs();\n  const noLabsSystems = getNoLabsSystems();",
  "const [globalNoLabsState, setGlobalNoLabsState] = useState(getGlobalNoLabs());\n  const [noLabsSystemsState, setNoLabsSystemsState] = useState(getNoLabsSystems());\n  const globalNoLabs = forceNoLabs || globalNoLabsState;\n  const noLabsSystems = noLabsSystemsState;\n\n  // Toggle forceNoLabs\n  const toggleForceNoLabs = () => {\n    const next = !forceNoLabs;\n    setForceNoLabs(next);\n    setGlobalNoLabs(next);\n    setGlobalNoLabsState(next);\n    if (next) setNoLabsSystemsState([]);\n    notifyDataChange();\n  };\n\n  // Listen for labs screen changes\n  useEffect(() => {\n    const interval = setInterval(() => {\n      setGlobalNoLabsState(getGlobalNoLabs());\n      setNoLabsSystemsState(getNoLabsSystems());\n    }, 2000);\n    return () => clearInterval(interval);\n  }, []);"
);

// Add notifyDataChange import (check if already there)
if (!c.includes('import { useDataLink, notifyDataChange }')) {
  c = c.replace(
    "import { useDataLink } from '../../core/data-link';",
    "import { useDataLink, notifyDataChange } from '../../core/data-link';"
  );
} else if (!c.includes('notifyDataChange')) {
  // add it
  c = c.replace('useDataLink', 'useDataLink, notifyDataChange');
}

fs.writeFileSync('src/ui/screens/RiskScreen.tsx', c, 'utf8');
console.log('RiskScreen: forceNoLabs state + toggle added');
